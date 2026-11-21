package dbtest

import (
	"context"
	"testing"

	"github.com/knnedy/nexusql/internal/db"
)

func testRows(t *testing.T, h Harness) {
	ctx := context.Background()
	p := setup(t, h)

	t.Run("pages with total count", func(t *testing.T) {
		_, rows, total, err := p.FetchRows(ctx, "users", 2, 0, "id", db.SortAsc, "")
		if err != nil {
			t.Fatal(err)
		}
		if total != 3 || len(rows) != 2 {
			t.Fatalf("page 1: total=%d rows=%d, want 3 and 2", total, len(rows))
		}
		_, rows, _, err = p.FetchRows(ctx, "users", 2, 2, "id", db.SortAsc, "")
		if err != nil {
			t.Fatal(err)
		}
		if len(rows) != 1 || str(rows[0]["email"]) != "cy@example.com" {
			t.Fatalf("page 2: got %v, want only cy@example.com", rows)
		}
	})

	t.Run("sorts descending", func(t *testing.T) {
		_, rows, _, err := p.FetchRows(ctx, "users", 10, 0, "email", db.SortDesc, "")
		if err != nil {
			t.Fatal(err)
		}
		if got := str(rows[0]["email"]); got != "cy@example.com" {
			t.Fatalf("first row email = %s, want cy@example.com", got)
		}
	})

	t.Run("returns columns in table order", func(t *testing.T) {
		cols, _, _, err := p.FetchRows(ctx, "users", 1, 0, "", db.SortAsc, "")
		if err != nil {
			t.Fatal(err)
		}
		if len(cols) != 3 || cols[0] != "id" || cols[1] != "email" || cols[2] != "name" {
			t.Fatalf("columns = %v, want [id email name]", cols)
		}
	})

	t.Run("search matches text case-insensitively", func(t *testing.T) {
		_, rows, total, err := p.FetchRows(ctx, "users", 10, 0, "", db.SortAsc, "ADA")
		if err != nil {
			t.Fatal(err)
		}
		if total != 1 || len(rows) != 1 || str(rows[0]["email"]) != "ada@example.com" {
			t.Fatalf("search ADA: total=%d rows=%v, want only ada@example.com", total, rows)
		}
	})

	t.Run("returns NULL as nil", func(t *testing.T) {
		_, rows, err := p.FetchRowWhere(ctx, "users", "email", "bob@example.com")
		if err != nil {
			t.Fatal(err)
		}
		if len(rows) != 1 || rows[0]["name"] != nil {
			t.Fatalf("bob's name = %v, want nil", rows)
		}
	})

	t.Run("lookup filters by column value", func(t *testing.T) {
		_, rows, err := p.FetchRowWhere(ctx, "posts", "user_id", "1")
		if err != nil {
			t.Fatal(err)
		}
		if len(rows) != 2 {
			t.Fatalf("posts for user 1 = %d rows, want 2", len(rows))
		}
	})

	t.Run("lookup rejects unknown column", func(t *testing.T) {
		if _, _, err := p.FetchRowWhere(ctx, "posts", "nope", "1"); err == nil {
			t.Fatal("expected error for unknown column")
		}
	})
}

func testUpdate(t *testing.T, h Harness) {
	ctx := context.Background()
	p := setup(t, h)

	t.Run("changes one cell", func(t *testing.T) {
		if err := p.UpdateRow(ctx, "posts", "id", "2", "title", "Edited"); err != nil {
			t.Fatal(err)
		}
		_, rows, err := p.FetchRowWhere(ctx, "posts", "id", "2")
		if err != nil {
			t.Fatal(err)
		}
		if got := str(rows[0]["title"]); got != "Edited" {
			t.Fatalf("title = %q, want Edited", got)
		}
	})

	t.Run("errors when no row matches", func(t *testing.T) {
		if err := p.UpdateRow(ctx, "posts", "id", "999", "title", "x"); err == nil {
			t.Fatal("expected error for missing row")
		}
	})

	t.Run("rejects unknown column", func(t *testing.T) {
		if err := p.UpdateRow(ctx, "posts", "id", "1", "nope", "x"); err == nil {
			t.Fatal("expected error for unknown column")
		}
	})
}
