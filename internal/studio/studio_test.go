package studio_test

import (
	"context"
	"errors"
	"path/filepath"
	"strings"
	"testing"
	"time"

	_ "github.com/knnedy/nexusql/internal/db/postgres"
	_ "github.com/knnedy/nexusql/internal/db/sqlite"
	"github.com/knnedy/nexusql/internal/projects"
	"github.com/knnedy/nexusql/internal/seed"
	"github.com/knnedy/nexusql/internal/session"
	"github.com/knnedy/nexusql/internal/studio"
)

// newService returns a Service with an isolated project store and no connection.
func newService(t *testing.T) *studio.Service {
	t.Helper()
	return newServiceWith(t, studio.Config{})
}

// newServiceWith is newService with explicit limits.
func newServiceWith(t *testing.T, cfg studio.Config) *studio.Service {
	t.Helper()
	t.Setenv("HOME", t.TempDir())
	proj, err := projects.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	sess := session.NewStore()
	t.Cleanup(sess.Clear)
	return studio.New(sess, proj, cfg)
}

func sqliteURI(t *testing.T) string {
	return "sqlite://" + filepath.Join(t.TempDir(), "studio.db")
}

// connected returns a Service connected to a SQLite db with a users table.
func connected(t *testing.T) *studio.Service {
	t.Helper()
	s := newService(t)
	ctx := context.Background()
	if _, err := s.Connect(ctx, sqliteURI(t), "test"); err != nil {
		t.Fatal(err)
	}
	for _, q := range []string{
		`CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT NOT NULL)`,
		`INSERT INTO users (email) VALUES ('a@x.io'), ('b@x.io')`,
	} {
		if _, err := s.Query(ctx, q, true); err != nil {
			t.Fatalf("%s: %v", q, err)
		}
	}
	return s
}

func TestOperationsWithoutConnection(t *testing.T) {
	s := newService(t)
	ctx := context.Background()
	ops := map[string]func() error{
		"Schema":     func() error { _, err := s.Schema(ctx, ""); return err },
		"Rows":       func() error { _, err := s.Rows(ctx, studio.RowsQuery{Table: "users"}); return err },
		"LookupRows": func() error { _, _, err := s.LookupRows(ctx, "users", "id", "1"); return err },
		"UpdateRow":  func() error { return s.UpdateRow(ctx, studio.RowUpdate{Table: "users"}) },
		"Query":      func() error { _, err := s.Query(ctx, "SELECT 1", false); return err },
		"Seed":       func() error { _, err := s.Seed(ctx, seed.Options{RowsPerTable: 1}); return err },
		"Export":     func() error { _, err := s.Export(ctx, "prisma"); return err },
		"TableDDL":   func() error { _, err := s.TableDDL(ctx, "users"); return err },
		"Disconnect": s.Disconnect,
	}
	for name, op := range ops {
		if err := op(); !errors.Is(err, studio.ErrNoConnection) {
			t.Errorf("%s: err = %v, want ErrNoConnection", name, err)
		}
	}
}

func TestConnect(t *testing.T) {
	ctx := context.Background()

	t.Run("rejects missing or unsupported URIs", func(t *testing.T) {
		s := newService(t)
		for _, uri := range []string{"", "oracle://host/db", "sqlite://relative.db"} {
			if _, err := s.Connect(ctx, uri, "x"); !errors.Is(err, studio.ErrInvalid) {
				t.Errorf("Connect(%q): err = %v, want ErrInvalid", uri, err)
			}
		}
	})

	t.Run("records a project and reuses it on reconnect", func(t *testing.T) {
		s := newService(t)
		uri := sqliteURI(t)
		first, err := s.Connect(ctx, uri, "mine")
		if err != nil {
			t.Fatal(err)
		}
		if first.ProjectID == "" || first.Provider != "sqlite" {
			t.Fatalf("got %+v, want a project id and provider sqlite", first)
		}
		again, err := s.Connect(ctx, uri, "mine")
		if err != nil {
			t.Fatal(err)
		}
		if again.ProjectID != first.ProjectID || len(s.Projects()) != 1 {
			t.Fatalf("reconnect made project %q (have %d), want reuse of %q",
				again.ProjectID, len(s.Projects()), first.ProjectID)
		}
	})

	t.Run("disconnect ends the session", func(t *testing.T) {
		s := connected(t)
		if err := s.Disconnect(); err != nil {
			t.Fatal(err)
		}
		if _, err := s.Rows(ctx, studio.RowsQuery{Table: "users", Limit: 1}); !errors.Is(err, studio.ErrNoConnection) {
			t.Fatalf("Rows after disconnect: err = %v, want ErrNoConnection", err)
		}
	})
}

func TestRowsSortValidation(t *testing.T) {
	s := connected(t)
	ctx := context.Background()

	if _, err := s.Rows(ctx, studio.RowsQuery{Table: "users", Limit: 10, SortCol: "nope"}); !errors.Is(err, studio.ErrInvalid) {
		t.Errorf("unknown sort column: err = %v, want ErrInvalid", err)
	}
	if _, err := s.Rows(ctx, studio.RowsQuery{Table: "ghost", Limit: 10, SortCol: "id"}); !errors.Is(err, studio.ErrInvalid) {
		t.Errorf("unknown table: err = %v, want ErrInvalid", err)
	}
	page, err := s.Rows(ctx, studio.RowsQuery{Table: "users", Limit: 10, SortCol: "email"})
	if err != nil || page.Total != 2 {
		t.Fatalf("valid sort: total=%d err=%v, want 2 rows", page.Total, err)
	}
}

func TestRowsFilterValidation(t *testing.T) {
	s := connected(t)
	ctx := context.Background()
	if _, err := s.Query(ctx, `CREATE TABLE items (id INTEGER PRIMARY KEY, label TEXT, qty INTEGER,
		done BOOLEAN, added DATE, meta JSON, size TEXT CHECK (size IN ('s', 'm', 'l')));
		INSERT INTO items (label, qty, done, added, size) VALUES ('pen', 3, 1, '2026-01-02', 's'),
		('Pencil', 10, 0, '2026-02-01', 'l')`, true); err != nil {
		t.Fatal(err)
	}
	rows := func(fs ...studio.RowFilter) (studio.RowsPage, error) {
		return s.Rows(ctx, studio.RowsQuery{Table: "items", Limit: 10, Filters: fs})
	}

	for name, f := range map[string]studio.RowFilter{
		"unknown column":            {Column: "nope", Op: "eq", Values: []string{"1"}},
		"unknown operator":          {Column: "qty", Op: "like", Values: []string{"1"}},
		"contains on a number":      {Column: "qty", Op: "contains", Values: []string{"1"}},
		"less than on text":         {Column: "label", Op: "lt", Values: []string{"p"}},
		"is one of on plain text":   {Column: "label", Op: "in", Values: []string{"pen"}},
		"equals on JSON":            {Column: "meta", Op: "eq", Values: []string{"{}"}},
		"a number that is not":      {Column: "qty", Op: "gt", Values: []string{"three"}},
		"a boolean that is not":     {Column: "done", Op: "in", Values: []string{"maybe"}},
		"a value outside the CHECK": {Column: "size", Op: "in", Values: []string{"xl"}},
		"is null with a value":      {Column: "label", Op: "isNull", Values: []string{"x"}},
		"equals with no value":      {Column: "label", Op: "eq"},
		"equals with two values":    {Column: "label", Op: "eq", Values: []string{"a", "b"}},
		"is one of with none":       {Column: "size", Op: "in"},
	} {
		if _, err := rows(f); !errors.Is(err, studio.ErrInvalid) {
			t.Errorf("%s: err = %v, want ErrInvalid", name, err)
		}
	}

	for name, c := range map[string]struct {
		filters []studio.RowFilter
		want    int64
	}{
		"text contains":     {[]studio.RowFilter{{Column: "label", Op: "contains", Values: []string{"PEN"}}}, 2},
		"number at least":   {[]studio.RowFilter{{Column: "qty", Op: "gte", Values: []string{"4"}}}, 1},
		"boolean is one of": {[]studio.RowFilter{{Column: "done", Op: "in", Values: []string{"true"}}}, 1},
		"date before":       {[]studio.RowFilter{{Column: "added", Op: "lt", Values: []string{"2026-02-01"}}}, 1},
		"CHECK is one of":   {[]studio.RowFilter{{Column: "size", Op: "in", Values: []string{"m", "l"}}}, 1},
		"JSON is null":      {[]studio.RowFilter{{Column: "meta", Op: "isNull"}}, 2},
		"both hold": {[]studio.RowFilter{
			{Column: "label", Op: "startsWith", Values: []string{"p"}}, {Column: "qty", Op: "lt", Values: []string{"5"}},
		}, 1},
	} {
		page, err := rows(c.filters...)
		if err != nil || page.Total != c.want {
			t.Errorf("%s: total=%d err=%v, want %d", name, page.Total, err, c.want)
		}
	}
}

func TestQuery(t *testing.T) {
	s := connected(t)
	ctx := context.Background()

	t.Run("destructive SQL needs confirmation and does not run", func(t *testing.T) {
		res, err := s.Query(ctx, "DELETE FROM users", false)
		if err != nil || !res.RequiresConfirmation {
			t.Fatalf("got %+v err=%v, want RequiresConfirmation", res, err)
		}
		page, _ := s.Rows(ctx, studio.RowsQuery{Table: "users", Limit: 10})
		if page.Total != 2 {
			t.Fatalf("rows after unconfirmed DELETE = %d, want 2", page.Total)
		}
	})

	t.Run("writes hidden behind a read need confirmation", func(t *testing.T) {
		for _, q := range []string{
			"SELECT 1; DELETE FROM users",
			"WITH doomed AS (SELECT id FROM users) DELETE FROM users WHERE id IN (SELECT id FROM doomed)",
			"/* SELECT */ DELETE FROM users",
			"PRAGMA foreign_keys = OFF",
		} {
			res, err := s.Query(ctx, q, false)
			if err != nil || !res.RequiresConfirmation {
				t.Errorf("Query(%q) = %+v err=%v, want RequiresConfirmation", q, res, err)
			}
		}
		page, _ := s.Rows(ctx, studio.RowsQuery{Table: "users", Limit: 10})
		if page.Total != 2 {
			t.Fatalf("rows after unconfirmed DELETEs = %d, want 2", page.Total)
		}
	})

	t.Run("reads run without confirmation and return rows", func(t *testing.T) {
		for q, want := range map[string]int{
			"PRAGMA table_info(users)":           2,
			"SELECT 'delete from users' AS s":    1,
			"VALUES (1), (2), (3)":               3,
			"SELECT 1; SELECT email FROM users;": 2,
		} {
			res, err := s.Query(ctx, q, false)
			if err != nil || res.RequiresConfirmation || len(res.Rows) != want {
				t.Errorf("Query(%q) = %+v err=%v, want %d rows", q, res, err, want)
			}
		}
	})

	t.Run("reports how many statements ran", func(t *testing.T) {
		res, err := s.Query(ctx, "SELECT 1; SELECT 2; SELECT 3", false)
		if err != nil || res.Statements != 3 {
			t.Fatalf("Statements = %d err=%v, want 3", res.Statements, err)
		}
	})

	t.Run("empty and invalid SQL are ErrInvalid", func(t *testing.T) {
		for _, q := range []string{"", " ; -- nothing\n;", "SELEC 1"} {
			if _, err := s.Query(ctx, q, true); !errors.Is(err, studio.ErrInvalid) {
				t.Errorf("Query(%q): err = %v, want ErrInvalid", q, err)
			}
		}
	})
}

func TestProjects(t *testing.T) {
	s := newService(t)

	if _, err := s.CreateProject("", "sqlite:///tmp/a.db"); !errors.Is(err, studio.ErrInvalid) {
		t.Errorf("missing name: err = %v, want ErrInvalid", err)
	}
	if _, err := s.CreateProject("a", "sqlite:///tmp/a.db"); err != nil {
		t.Fatal(err)
	}
	if _, err := s.CreateProject("a", "sqlite:///tmp/b.db"); !errors.Is(err, studio.ErrConflict) {
		t.Errorf("duplicate name: err = %v, want ErrConflict", err)
	}
	for name, err := range map[string]error{
		"Rename": s.RenameProject("missing", "x"),
		"Delete": s.DeleteProject("missing"),
		"Touch":  s.TouchProject("missing"),
	} {
		if !errors.Is(err, studio.ErrNotFound) {
			t.Errorf("%s missing project: err = %v, want ErrNotFound", name, err)
		}
	}
}

func TestConnectErrorsNeverContainThePassword(t *testing.T) {
	s := newService(t)
	const pw = "s3cret-pw"
	for _, uri := range []string{
		"oracle://u:" + pw + "@h/db",                 // unsupported scheme
		"mysql://u:" + pw + "@/db",                   // missing host
		"mysql://u:" + pw + "@127.0.0.1:1/db",        // unreachable
		"postgres://u:" + pw + "@127.0.0.1:1/db",     // unreachable
		"postgres://u:" + pw + "@h:notaport/db",      // unparseable port
		"postgres://u:" + pw + "@h/db?sslmode=bogus", // bad option
		"sqlite://u:" + pw + "@relative.db",          // relative path
	} {
		_, err := s.Connect(context.Background(), uri, "x")
		if err == nil {
			t.Errorf("%s: expected an error", uri)
			continue
		}
		if strings.Contains(err.Error(), pw) {
			t.Errorf("error leaks the password: %v", err)
		}
	}
}

func TestProjectsNeverExposeThePassword(t *testing.T) {
	s := newService(t)
	created, err := s.CreateProject("shop", "postgres://app:s3cret-pw@db.local/shop")
	if err != nil {
		t.Fatal(err)
	}
	if created.DisplayURI != "postgres://app:****@db.local/shop" {
		t.Errorf("created DisplayURI = %q", created.DisplayURI)
	}
	for _, p := range s.Projects() {
		if strings.Contains(p.DisplayURI, "s3cret-pw") {
			t.Errorf("listed project leaks the password: %q", p.DisplayURI)
		}
	}
}

func TestOpenProject(t *testing.T) {
	ctx := context.Background()

	t.Run("connects to a saved project by id", func(t *testing.T) {
		s := newService(t)
		p, err := s.CreateProject("local", sqliteURI(t))
		if err != nil {
			t.Fatal(err)
		}
		res, err := s.OpenProject(ctx, p.ID)
		if err != nil {
			t.Fatal(err)
		}
		if res.ProjectID != p.ID || res.Provider != "sqlite" {
			t.Fatalf("got %+v, want project %s on sqlite", res, p.ID)
		}
		if _, err := s.Query(ctx, "SELECT 1", false); err != nil {
			t.Fatalf("query after open: %v", err)
		}
		if got := s.Projects()[0].LastOpenedAt; got.IsZero() {
			t.Fatal("LastOpenedAt not set")
		}
	})

	t.Run("unknown id is ErrNotFound", func(t *testing.T) {
		if _, err := newService(t).OpenProject(ctx, "missing"); !errors.Is(err, studio.ErrNotFound) {
			t.Fatalf("err = %v, want ErrNotFound", err)
		}
	})
}

func TestSQLite(t *testing.T) {
	testDialect(t, sqliteURI(t),
		`WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM c) SELECT count(*) FROM c`)
}

func TestConnectTimeout(t *testing.T) {
	s := newServiceWith(t, studio.Config{ConnectTimeout: 300 * time.Millisecond})
	start := time.Now()
	// 10.255.255.1 is unroutable: without a timeout the dial hangs for minutes.
	_, err := s.Connect(context.Background(), "postgres://u:p@10.255.255.1:5432/db", "x")
	if err == nil || time.Since(start) > 3*time.Second {
		t.Fatalf("err=%v after %s, want an error within the connect timeout", err, time.Since(start))
	}
}

func TestReadOnly(t *testing.T) {
	ctx := context.Background()
	if _, err := newService(t).ReadOnly(); !errors.Is(err, studio.ErrNoConnection) {
		t.Fatalf("ReadOnly without a connection: err = %v, want ErrNoConnection", err)
	}

	s := connected(t)
	if on, err := s.ReadOnly(); err != nil || on {
		t.Fatalf("new connection: read-only = %v err=%v, want false", on, err)
	}
	if err := s.SetReadOnly(true); err != nil {
		t.Fatal(err)
	}
	usersLeft := func(t *testing.T) int64 {
		t.Helper()
		page, err := s.Rows(ctx, studio.RowsQuery{Table: "users", Limit: 10})
		if err != nil {
			t.Fatal(err)
		}
		return page.Total
	}

	t.Run("writes go to the database unconfirmed and are refused there", func(t *testing.T) {
		res, err := s.Query(ctx, "DELETE FROM users", false)
		if res.RequiresConfirmation || !errors.Is(err, studio.ErrInvalid) || usersLeft(t) != 2 {
			t.Fatalf("got %+v err=%v rows=%d, want a database error and 2 rows", res, err, usersLeft(t))
		}
	})
	t.Run("statements that would leave read-only mode are not run", func(t *testing.T) {
		_, err := s.Query(ctx, "PRAGMA query_only = OFF; DELETE FROM users", false)
		if !errors.Is(err, studio.ErrInvalid) || !strings.Contains(err.Error(), "read-only") || usersLeft(t) != 2 {
			t.Fatalf("err=%v rows=%d, want a read-only refusal and 2 rows", err, usersLeft(t))
		}
	})
	t.Run("reads still work", func(t *testing.T) {
		if res, err := s.Query(ctx, "SELECT email FROM users", false); err != nil || len(res.Rows) != 2 {
			t.Fatalf("got %+v err=%v", res, err)
		}
	})
	t.Run("row edits and seeding are refused", func(t *testing.T) {
		v := "z@x.io"
		err := s.UpdateRow(ctx, studio.RowUpdate{Table: "users", Key: map[string]string{"id": "1"}, Column: "email", Value: &v})
		if !errors.Is(err, studio.ErrConflict) {
			t.Errorf("UpdateRow: err = %v, want ErrConflict", err)
		}
		if _, err := s.Seed(ctx, seed.Options{RowsPerTable: 1}); !errors.Is(err, studio.ErrConflict) {
			t.Errorf("Seed: err = %v, want ErrConflict", err)
		}
	})
	t.Run("a new connection starts read-write", func(t *testing.T) {
		if _, err := s.Connect(ctx, sqliteURI(t), "other"); err != nil {
			t.Fatal(err)
		}
		if on, _ := s.ReadOnly(); on {
			t.Fatal("read-only carried over to a new connection")
		}
	})
}
