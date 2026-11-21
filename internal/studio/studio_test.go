package studio_test

import (
	"context"
	"errors"
	"path/filepath"
	"strings"
	"testing"

	_ "github.com/knnedy/nexusql/internal/db/sqlite"
	"github.com/knnedy/nexusql/internal/projects"
	"github.com/knnedy/nexusql/internal/seed"
	"github.com/knnedy/nexusql/internal/session"
	"github.com/knnedy/nexusql/internal/studio"
)

// newService returns a Service with an isolated project store and no connection.
func newService(t *testing.T) *studio.Service {
	t.Helper()
	t.Setenv("HOME", t.TempDir())
	proj, err := projects.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	sess := session.NewStore()
	t.Cleanup(sess.Clear)
	return studio.New(sess, proj)
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
		"Export":     func() error { _, err := s.Export(ctx, studio.ExportPrisma); return err },
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

	t.Run("empty and invalid SQL are ErrInvalid", func(t *testing.T) {
		for _, q := range []string{"", "SELEC 1"} {
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

func TestSQLite(t *testing.T) { testDialect(t, sqliteURI(t)) }
