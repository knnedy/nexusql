package dbtest

import (
	"testing"

	"github.com/knnedy/nexusql/internal/db"
)

func testRows(t *testing.T, h Harness) {
	p := setup(t, h)

	t.Run("pages with total count", func(t *testing.T) {
		_, rows, total, err := page(t, p, "users", 2, 0, "id", db.SortAsc, "")
		if err != nil {
			t.Fatal(err)
		}
		if total != 3 || len(rows) != 2 {
			t.Fatalf("page 1: total=%d rows=%d, want 3 and 2", total, len(rows))
		}
		_, rows, _, err = page(t, p, "users", 2, 2, "id", db.SortAsc, "")
		if err != nil {
			t.Fatal(err)
		}
		if len(rows) != 1 || str(rows[0]["email"]) != "cy@example.com" {
			t.Fatalf("page 2: got %v, want only cy@example.com", rows)
		}
	})

	t.Run("sorts descending", func(t *testing.T) {
		_, rows, _, err := page(t, p, "users", 10, 0, "email", db.SortDesc, "")
		if err != nil {
			t.Fatal(err)
		}
		if got := str(rows[0]["email"]); got != "cy@example.com" {
			t.Fatalf("first row email = %s, want cy@example.com", got)
		}
	})

	t.Run("returns columns in table order", func(t *testing.T) {
		cols, _, _, err := page(t, p, "users", 1, 0, "", db.SortAsc, "")
		if err != nil {
			t.Fatal(err)
		}
		if len(cols) != 3 || cols[0] != "id" || cols[1] != "email" || cols[2] != "name" {
			t.Fatalf("columns = %v, want [id email name]", cols)
		}
	})

	t.Run("search matches text case-insensitively", func(t *testing.T) {
		_, rows, total, err := page(t, p, "users", 10, 0, "", db.SortAsc, "ADA")
		if err != nil {
			t.Fatal(err)
		}
		if total != 1 || len(rows) != 1 || str(rows[0]["email"]) != "ada@example.com" {
			t.Fatalf("search ADA: total=%d rows=%v, want only ada@example.com", total, rows)
		}
	})

	t.Run("search treats LIKE wildcards literally", func(t *testing.T) {
		if err := update(t, p, "users", "id", "3", "name", `C:\50%_off`); err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { _ = update(t, p, "users", "id", "3", "name", "Cy") })
		for search, want := range map[string]int64{"50%_": 1, "_": 1, "%": 1, `\`: 1, `\%`: 0, "5_%": 0} {
			_, _, total, err := page(t, p, "users", 10, 0, "", db.SortAsc, search)
			if err != nil {
				t.Fatalf("search %q: %v", search, err)
			}
			if total != want {
				t.Errorf("search %q matched %d rows, want %d", search, total, want)
			}
		}
	})

	t.Run("returns NULL as nil", func(t *testing.T) {
		_, rows, err := lookup(t, p, "users", "email", "bob@example.com")
		if err != nil {
			t.Fatal(err)
		}
		if len(rows) != 1 || rows[0]["name"] != nil {
			t.Fatalf("bob's name = %v, want nil", rows)
		}
	})
}

func testUpdate(t *testing.T, h Harness) {
	p := setup(t, h)

	t.Run("cannot point a foreign key at no row", func(t *testing.T) {
		if err := update(t, p, "posts", "id", "3", "user_id", "999"); err == nil {
			t.Fatal("posts.user_id = 999 saved, but no user 999 exists")
		}
	})

	t.Run("changes one cell", func(t *testing.T) {
		if err := update(t, p, "posts", "id", "2", "title", "Edited"); err != nil {
			t.Fatal(err)
		}
		_, rows, err := lookup(t, p, "posts", "id", "2")
		if err != nil {
			t.Fatal(err)
		}
		if got := str(rows[0]["title"]); got != "Edited" {
			t.Fatalf("title = %q, want Edited", got)
		}
	})

	t.Run("errors when no row matches", func(t *testing.T) {
		if err := update(t, p, "posts", "id", "999", "title", "x"); err == nil {
			t.Fatal("expected error for missing row")
		}
	})
}
