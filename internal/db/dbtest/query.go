package dbtest

import (
	"context"
	"strings"
	"testing"

	"github.com/knnedy/nexusql/internal/db"
	"github.com/knnedy/nexusql/internal/seed"
	"github.com/knnedy/nexusql/internal/sqlscan"
)

func testQuery(t *testing.T, h Harness) {
	ctx := context.Background()
	p := setup(t, h)

	t.Run("select returns rows", func(t *testing.T) {
		res, err := Script(ctx, p, "SELECT email FROM users ORDER BY id", 0)
		if err != nil {
			t.Fatal(err)
		}
		if res.IsWrite || len(res.Columns) != 1 || res.Columns[0] != "email" || len(res.Rows) != 3 || res.Truncated {
			t.Fatalf("got %+v, want 3 email rows, not truncated", res)
		}
	})

	t.Run("caps rows without rewriting the SQL", func(t *testing.T) {
		for _, c := range []struct {
			sql       string
			max, rows int
			truncated bool
		}{
			{"SELECT email FROM users ORDER BY id", 2, 2, true},
			{"SELECT email FROM users ORDER BY id", 3, 3, false},
			// a "limit" inside a literal used to suppress the appended LIMIT
			{"SELECT email FROM users WHERE email <> 'limit 1' ORDER BY id", 2, 2, true},
			{"SELECT email FROM users ORDER BY id\n-- trailing comment", 1, 1, true},
		} {
			res, err := Script(ctx, p, c.sql, c.max)
			if err != nil {
				t.Fatalf("%q: %v", c.sql, err)
			}
			if len(res.Rows) != c.rows || res.Truncated != c.truncated {
				t.Errorf("%q max %d: rows=%d truncated=%v, want %d %v", c.sql, c.max, len(res.Rows), res.Truncated, c.rows, c.truncated)
			}
		}
	})

	t.Run("write reports affected rows", func(t *testing.T) {
		res, err := Script(ctx, p, "UPDATE posts SET title = 'x' WHERE user_id = 1", 0)
		if err != nil {
			t.Fatal(err)
		}
		if !res.IsWrite || res.RowsAffected != 2 {
			t.Fatalf("got %+v, want a write affecting 2", res)
		}
	})

	t.Run("invalid SQL errors", func(t *testing.T) {
		if _, err := Script(ctx, p, "SELEC 1", 0); err == nil {
			t.Fatal("expected syntax error")
		}
	})

	count := func(t *testing.T, where string) string {
		t.Helper()
		res, err := Script(ctx, p, "SELECT COUNT(*) AS n FROM users WHERE "+where, 0)
		if err != nil || len(res.Rows) != 1 {
			t.Fatalf("count: %v %v", res.Rows, err)
		}
		return str(res.Rows[0]["n"])
	}

	t.Run("statements run in order and the last one answers", func(t *testing.T) {
		res, err := Script(ctx, p, `SELECT email FROM users;
			INSERT INTO users (id, email) VALUES (100, 'semi;colon@x');
			SELECT email FROM users WHERE id = 100;`, 0)
		if err != nil {
			t.Fatal(err)
		}
		if !res.IsWrite || len(res.Rows) != 1 || str(res.Rows[0]["email"]) != "semi;colon@x" {
			t.Fatalf("got %+v, want the inserted row from the last statement", res)
		}
	})

	t.Run("a transaction spans the statements of a run", func(t *testing.T) {
		if _, err := Script(ctx, p, "BEGIN; INSERT INTO users (id, email) VALUES (101, 'tx@x'); ROLLBACK", 0); err != nil {
			t.Fatal(err)
		}
		if n := count(t, "id = 101"); n != "0" {
			t.Fatalf("%s rows after ROLLBACK, want 0: statements ran on different connections", n)
		}
	})

	t.Run("an unfinished transaction is rolled back", func(t *testing.T) {
		if _, err := Script(ctx, p, "BEGIN; INSERT INTO users (id, email) VALUES (102, 'open@x')", 0); err != nil {
			t.Fatal(err)
		}
		if n := count(t, "id = 102"); n != "0" {
			t.Fatalf("%s rows from a transaction never committed, want 0", n)
		}
		if _, err := Script(ctx, p, "INSERT INTO users (id, email) VALUES (103, 'after@x')", 0); err != nil {
			t.Fatalf("write after an abandoned transaction: %v", err)
		}
	})

	t.Run("session state ends with the run", func(t *testing.T) {
		if _, err := Script(ctx, p, "CREATE TEMPORARY TABLE scratch (x INT)", 0); err != nil {
			t.Fatal(err)
		}
		if _, err := Script(ctx, p, "SELECT x FROM scratch", 0); err == nil {
			t.Fatal("a temporary table outlived the run that made it")
		}
	})

	t.Run("errors name the failing statement", func(t *testing.T) {
		_, err := Script(ctx, p, "SELECT 1; SELEC 2", 0)
		if err == nil || !strings.Contains(err.Error(), "statement 2 of 2") {
			t.Fatalf("err = %v, want it to name statement 2 of 2", err)
		}
	})

	t.Run("read-only runs are refused writes by the database", func(t *testing.T) {
		ro := func(sql string) (db.QueryResult, error) {
			return p.ExecuteScript(ctx, sqlscan.Split(sql, p.Syntax()), db.ScriptOptions{ReadOnly: true})
		}
		if res, err := ro("SELECT email FROM users WHERE id = 1"); err != nil || len(res.Rows) != 1 {
			t.Fatalf("read in read-only mode: %+v %v", res, err)
		}
		for _, sql := range []string{
			"INSERT INTO users (id, email) VALUES (200, 'ro@x')",
			"BEGIN; INSERT INTO users (id, email) VALUES (200, 'ro@x'); COMMIT",
			"UPDATE users SET email = 'ro@x' WHERE id = 1",
			"CREATE TABLE ro_made (x INT)",
		} {
			if _, err := ro(sql); err == nil {
				t.Errorf("%q succeeded in read-only mode", sql)
			}
		}
		if n := count(t, "id = 200 OR email = 'ro@x'"); n != "0" {
			t.Fatalf("%s rows written in read-only mode", n)
		}
		if _, err := Script(ctx, p, "SELECT * FROM ro_made", 0); err == nil {
			t.Fatal("a table was created in read-only mode")
		}
		if _, err := Script(ctx, p, "INSERT INTO users (id, email) VALUES (201, 'rw@x')", 0); err != nil {
			t.Fatalf("read-only mode outlived its run: %v", err)
		}
	})

	t.Run("cancelled context stops the query", func(t *testing.T) {
		cctx, cancel := context.WithCancel(ctx)
		cancel()
		if _, err := Script(cctx, p, "SELECT email FROM users", 0); err == nil {
			t.Fatal("expected an error from a cancelled context")
		}
	})
}

func testSeed(t *testing.T, h Harness) {
	ctx := context.Background()
	p := setup(t, h)
	schema, err := p.IntrospectSchema(ctx, p.DefaultSchema())
	if err != nil {
		t.Fatal(err)
	}

	res, err := seed.Run(ctx, p, schema, seed.Options{RowsPerTable: 5, NullChance: 0.5})
	if err != nil {
		t.Fatalf("seed: %v", err)
	}

	t.Run("inserts rows per table", func(t *testing.T) {
		if res.RowsInserted["users"] != 5 || res.RowsInserted["posts"] != 5 {
			t.Fatalf("RowsInserted = %v, want 5 each", res.RowsInserted)
		}
		_, rows, total, err := page(t, p, "posts", 1, 0, "", db.SortAsc, "")
		if err != nil || total != 8 || len(rows) != 1 {
			t.Fatalf("posts total = %d (err %v), want 3 fixture + 5 seeded", total, err)
		}
	})

	t.Run("seeded foreign keys reference existing rows", func(t *testing.T) {
		res, err := Script(ctx, p,
			"SELECT COUNT(*) AS orphans FROM posts WHERE user_id NOT IN (SELECT id FROM users)", 0)
		if err != nil {
			t.Fatal(err)
		}
		if got := str(res.Rows[0]["orphans"]); got != "0" {
			t.Fatalf("orphaned posts = %s, want 0", got)
		}
	})
}

func testExport(t *testing.T, h Harness) {
	p := setup(t, h)
	schema, err := p.IntrospectSchema(context.Background(), p.DefaultSchema())
	if err != nil {
		t.Fatal(err)
	}
	exp, err := db.ExporterFor(p.Kind())
	if err != nil {
		t.Fatalf("no exporter registered: %v", err)
	}

	for name, out := range map[string]string{"prisma": exp.Prisma(schema), "drizzle": exp.Drizzle(schema)} {
		lower := strings.ToLower(out)
		if !strings.Contains(lower, "users") || !strings.Contains(lower, "posts") {
			t.Errorf("%s output does not mention both fixture tables:\n%s", name, out)
		}
	}
}
