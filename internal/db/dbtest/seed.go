package dbtest

import (
	"context"
	"regexp"
	"testing"

	"github.com/knnedy/nexusql/internal/db"
	"github.com/knnedy/nexusql/internal/seed"
)

// Seed exercises the seeder on tables the database constrains. Setup must
// create, in dialect DDL:
//
//	files(id auto PK, data binary NOT NULL)
//	flags(id auto PK, on_off boolean NOT NULL UNIQUE)
//	scores(id auto PK, n integer NOT NULL CHECK (n BETWEEN 1 AND 50))
type Seed struct {
	Setup  []string
	Stored map[string]string // query -> expected first cell: how values were stored
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

var hexBytes = regexp.MustCompile(`^\\x[0-9a-f]{32}$`)

func testSeedConstraints(t *testing.T, h Harness) {
	if h.Seed.Setup == nil {
		t.Skip("harness has no seed fixture")
	}
	ctx := context.Background()
	p := h.Open(t)
	for _, stmt := range h.Seed.Setup {
		mustExec(t, p, stmt)
	}
	schema, err := p.IntrospectSchema(ctx, p.DefaultSchema())
	if err != nil {
		t.Fatal(err)
	}
	res, err := seed.Run(ctx, p, schema, seed.Options{RowsPerTable: 5})
	if err != nil {
		t.Fatalf("one rejected row aborted the seed: %v", err)
	}

	t.Run("binary values are stored as bytes", func(t *testing.T) {
		_, rows, total, err := page(t, p, "files", 10, 0, "", db.SortAsc, "")
		if err != nil || total != 5 {
			t.Fatalf("files: %d rows, err %v", total, err)
		}
		for _, r := range rows {
			if s, _ := r["data"].(string); !hexBytes.MatchString(s) {
				t.Errorf("data = %q, want 16 bytes as \\x hex", s)
			}
		}
		for q, want := range h.Seed.Stored {
			got, err := Script(ctx, p, q, 1)
			if err != nil || len(got.Rows) != 1 || str(firstCell(got)) != want {
				t.Errorf("%s = %v (err %v), want %s", q, got.Rows, err, want)
			}
		}
	})

	t.Run("rejected rows are retried, then skipped and reported", func(t *testing.T) {
		if res.RowsInserted["flags"] != 2 || res.Skipped["flags"] != 3 || res.Problems["flags"] == "" {
			t.Errorf("flags: inserted %d skipped %d problem %q, want 2, 3 and the reason",
				res.RowsInserted["flags"], res.Skipped["flags"], res.Problems["flags"])
		}
		if n := res.RowsInserted["scores"] + res.Skipped["scores"]; n != 5 {
			t.Errorf("scores: %d inserted + skipped, want 5", n)
		}
	})
}

func firstCell(r db.QueryResult) any {
	return r.Rows[0][r.Columns[0]]
}
