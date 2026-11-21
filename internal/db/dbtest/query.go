package dbtest

import (
	"context"
	"strings"
	"testing"

	"github.com/knnedy/nexusql/internal/db"
	"github.com/knnedy/nexusql/internal/seed"
)

func testQuery(t *testing.T, h Harness) {
	ctx := context.Background()
	p := setup(t, h)

	t.Run("select returns rows", func(t *testing.T) {
		res, err := p.ExecuteQuery(ctx, "SELECT email FROM users ORDER BY id", 0)
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
			res, err := p.ExecuteQuery(ctx, c.sql, c.max)
			if err != nil {
				t.Fatalf("%q: %v", c.sql, err)
			}
			if len(res.Rows) != c.rows || res.Truncated != c.truncated {
				t.Errorf("%q max %d: rows=%d truncated=%v, want %d %v", c.sql, c.max, len(res.Rows), res.Truncated, c.rows, c.truncated)
			}
		}
	})

	t.Run("write reports affected rows", func(t *testing.T) {
		res, err := p.ExecuteQuery(ctx, "UPDATE posts SET title = 'x' WHERE user_id = 1", 0)
		if err != nil {
			t.Fatal(err)
		}
		if !res.IsWrite || res.RowsAffected != 2 {
			t.Fatalf("got %+v, want a write affecting 2", res)
		}
	})

	t.Run("invalid SQL errors", func(t *testing.T) {
		if _, err := p.ExecuteQuery(ctx, "SELEC 1", 0); err == nil {
			t.Fatal("expected syntax error")
		}
	})

	t.Run("cancelled context stops the query", func(t *testing.T) {
		cctx, cancel := context.WithCancel(ctx)
		cancel()
		if _, err := p.ExecuteQuery(cctx, "SELECT email FROM users", 0); err == nil {
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
		res, err := p.ExecuteQuery(ctx,
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
