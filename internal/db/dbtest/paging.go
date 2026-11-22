package dbtest

import (
	"context"
	"slices"
	"testing"

	"github.com/knnedy/nexusql/internal/db"
)

func testPaging(t *testing.T, h Harness) {
	p := setup(t, h)
	ctx := context.Background()

	// titles fetches posts (user_id 1, 1, 3 for ids 1, 2, 3) as titles.
	titles := func(t *testing.T, req db.RowsRequest) []string {
		t.Helper()
		_, rows, err := p.FetchRows(ctx, req)
		if err != nil {
			t.Fatal(err)
		}
		var got []string
		for _, r := range rows {
			got = append(got, str(r["title"]))
		}
		return got
	}
	posts := tableOf(t, p, "posts")
	userID := fieldOf(t, posts, "user_id")

	for _, c := range []struct {
		name string
		req  db.RowsRequest
		want []string
	}{
		{"ties break by primary key, descending too",
			db.RowsRequest{Table: posts, Limit: 10, Sort: &userID, SortDir: db.SortDesc},
			[]string{"Third", "Second", "Hello"}},
		{"no sort orders by primary key",
			db.RowsRequest{Table: posts, Limit: 10},
			[]string{"Hello", "Second", "Third"}},
		{"after a cursor, sorted",
			db.RowsRequest{Table: posts, Limit: 10, Sort: &userID, After: []string{"1", "1"}},
			[]string{"Second", "Third"}},
		{"after a cursor, descending",
			db.RowsRequest{Table: posts, Limit: 10, Sort: &userID, SortDir: db.SortDesc, After: []string{"1", "2"}},
			[]string{"Hello"}},
		{"after a cursor, by primary key",
			db.RowsRequest{Table: posts, Limit: 1, After: []string{"1"}},
			[]string{"Second"}},
		{"a cursor replaces the offset",
			db.RowsRequest{Table: posts, Limit: 10, Offset: 2, After: []string{"1"}},
			[]string{"Second", "Third"}},
		{"a cursor applies with filters",
			db.RowsRequest{Table: posts, Limit: 10, After: []string{"1"},
				Filters: []db.Filter{{Field: userID, Op: db.FilterEq, Values: []string{"1"}}}},
			[]string{"Second"}},
	} {
		t.Run(c.name, func(t *testing.T) {
			if got := titles(t, c.req); !slices.Equal(got, c.want) {
				t.Fatalf("got %v, want %v", got, c.want)
			}
		})
	}

	t.Run("a later key with a smaller sort value is not after the cursor", func(t *testing.T) {
		q := setup(t, h)
		mustExec(t, q, `INSERT INTO posts (user_id, title) VALUES (1, 'Fourth')`) // id 4
		qposts := tableOf(t, q, "posts")
		qUser := fieldOf(t, qposts, "user_id")
		_, rows, err := q.FetchRows(ctx, db.RowsRequest{Table: qposts, Limit: 10, Sort: &qUser, After: []string{"3", "3"}})
		if err != nil || len(rows) != 0 {
			t.Fatalf("after the last row: %v, %v; want none", rows, err)
		}
	})

	t.Run("count takes search and filters but not the cursor", func(t *testing.T) {
		users := tableOf(t, p, "users")
		name := fieldOf(t, users, "name")
		for _, c := range []struct {
			req  db.RowsRequest
			want int64
		}{
			{db.RowsRequest{Table: users}, 3},
			{db.RowsRequest{Table: users, Search: "ada"}, 1},
			{db.RowsRequest{Table: users, Filters: []db.Filter{{Field: name, Op: db.FilterNotNull}}}, 2},
			{db.RowsRequest{Table: users, After: []string{"2"}, Offset: 2, Limit: 1}, 3},
		} {
			n, err := p.CountRows(ctx, c.req)
			if err != nil || n != c.want {
				t.Errorf("count %+v = %d, %v; want %d", c.req, n, err, c.want)
			}
		}
	})

	t.Run("composite keys page by every key column", func(t *testing.T) {
		if h.Keys.Setup == nil {
			t.Skip("harness has no key fixture")
		}
		q := h.Open(t)
		for _, stmt := range append(slices.Clone(h.Keys.Setup),
			`INSERT INTO parent (a, b) VALUES (1, 1), (1, 2), (2, 1), (2, 2)`) {
			mustExec(t, q, stmt)
		}
		_, rows, err := q.FetchRows(ctx, db.RowsRequest{Table: tableOf(t, q, "parent"), Limit: 2, After: []string{"1", "2"}})
		if err != nil {
			t.Fatal(err)
		}
		var got []string
		for _, r := range rows {
			got = append(got, str(r["a"])+","+str(r["b"]))
		}
		if !slices.Equal(got, []string{"2,1", "2,2"}) {
			t.Fatalf("got %v, want [2,1 2,2]", got)
		}
	})
}
