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
		cols, rows, _, isWrite, err := p.ExecuteQuery(ctx, "SELECT email FROM users ORDER BY id")
		if err != nil {
			t.Fatal(err)
		}
		if isWrite || len(cols) != 1 || cols[0] != "email" || len(rows) != 3 {
			t.Fatalf("isWrite=%v cols=%v rows=%d, want false [email] 3", isWrite, cols, len(rows))
		}
	})

	t.Run("write reports affected rows", func(t *testing.T) {
		_, _, affected, isWrite, err := p.ExecuteQuery(ctx, "UPDATE posts SET title = 'x' WHERE user_id = 1")
		if err != nil {
			t.Fatal(err)
		}
		if !isWrite || affected != 2 {
			t.Fatalf("isWrite=%v affected=%d, want true 2", isWrite, affected)
		}
	})

	t.Run("invalid SQL errors", func(t *testing.T) {
		if _, _, _, _, err := p.ExecuteQuery(ctx, "SELEC 1"); err == nil {
			t.Fatal("expected syntax error")
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
		_, rows, total, err := p.FetchRows(ctx, "posts", 1, 0, "", db.SortAsc, "")
		if err != nil || total != 8 || len(rows) != 1 {
			t.Fatalf("posts total = %d (err %v), want 3 fixture + 5 seeded", total, err)
		}
	})

	t.Run("seeded foreign keys reference existing rows", func(t *testing.T) {
		_, rows, _, _, err := p.ExecuteQuery(ctx,
			"SELECT COUNT(*) AS orphans FROM posts WHERE user_id NOT IN (SELECT id FROM users)")
		if err != nil {
			t.Fatal(err)
		}
		if got := str(rows[0]["orphans"]); got != "0" {
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
