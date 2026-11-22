package dbtest

import (
	"context"
	"slices"
	"testing"

	"github.com/knnedy/nexusql/internal/db"
)

// Filters is a dialect's "moods" table: Setup creates moods(id, mood) where
// mood is an enum (or CHECK IN) of happy/sad/meh, holding happy, sad, happy.
type Filters struct {
	Setup []string
}

type cond struct {
	col    string
	op     db.FilterOp
	values []string
}

type filterCase struct {
	name, table, search string
	conds               []cond
	pick                string   // column whose values identify the rows
	want                []string // pick values in id order
}

func testFilters(t *testing.T, h Harness) {
	p := setup(t, h)
	for _, stmt := range h.Values.Setup {
		mustExec(t, p, stmt)
	}
	cases := []filterCase{
		{"equals takes text for a number", "posts", "", []cond{{"user_id", db.FilterEq, []string{"1"}}}, "title", []string{"Hello", "Second"}},
		{"not equals", "posts", "", []cond{{"user_id", db.FilterNe, []string{"1"}}}, "title", []string{"Third"}},
		{"is null", "users", "", []cond{{"name", db.FilterIsNull, nil}}, "email", []string{"bob@example.com"}},
		{"is not null", "users", "", []cond{{"name", db.FilterNotNull, nil}}, "email", []string{"ada@example.com", "cy@example.com"}},
		{"less than", "posts", "", []cond{{"user_id", db.FilterLt, []string{"3"}}}, "title", []string{"Hello", "Second"}},
		{"at most", "posts", "", []cond{{"user_id", db.FilterLte, []string{"1"}}}, "title", []string{"Hello", "Second"}},
		{"greater than", "posts", "", []cond{{"user_id", db.FilterGt, []string{"1"}}}, "title", []string{"Third"}},
		{"at least", "posts", "", []cond{{"user_id", db.FilterGte, []string{"3"}}}, "title", []string{"Third"}},
		{"contains ignores case", "users", "", []cond{{"email", db.FilterContains, []string{"Y@EX"}}}, "email", []string{"cy@example.com"}},
		{"contains is literal", "users", "", []cond{{"email", db.FilterContains, []string{"_"}}}, "email", nil},
		{"starts with ignores case", "users", "", []cond{{"email", db.FilterStartsWith, []string{"B"}}}, "email", []string{"bob@example.com"}},
		{"starts with is literal", "users", "", []cond{{"email", db.FilterStartsWith, []string{"%"}}}, "email", nil},
		{"starts with anchors", "users", "", []cond{{"email", db.FilterStartsWith, []string{"example"}}}, "email", nil},
		{"is one of", "users", "", []cond{{"email", db.FilterIn, []string{"cy@example.com", "ada@example.com"}}}, "email", []string{"ada@example.com", "cy@example.com"}},
		{"a quote in a value is data", "users", "", []cond{{"email", db.FilterEq, []string{"x' OR '1'='1"}}}, "email", nil},
		{"filters combine with AND", "posts", "", []cond{
			{"user_id", db.FilterEq, []string{"1"}}, {"title", db.FilterStartsWith, []string{"s"}},
		}, "title", []string{"Second"}},
		{"search stays grouped under a filter", "users", "ada", []cond{{"name", db.FilterIsNull, nil}}, "email", nil},
		{"search and filter both apply", "users", "example", []cond{{"name", db.FilterNotNull, nil}}, "email", []string{"ada@example.com", "cy@example.com"}},
		{"boolean true", "vals", "", []cond{{"flag", db.FilterEq, []string{"true"}}}, "id", []string{"1"}},
		{"boolean false", "vals", "", []cond{{"flag", db.FilterEq, []string{"false"}}}, "id", nil},
		{"date at least", "vals", "", []cond{{"d", db.FilterGte, []string{"2026-01-02"}}}, "id", []string{"1"}},
		{"date after", "vals", "", []cond{{"d", db.FilterGt, []string{"2026-01-02"}}}, "id", nil},
		{"timestamp before", "vals", "", []cond{{"ts", db.FilterLt, []string{"2026-01-03 00:00:00"}}}, "id", []string{"1"}},
	}
	if h.Filters.Setup != nil {
		for _, stmt := range h.Filters.Setup {
			mustExec(t, p, stmt)
		}
		cases = append(cases,
			filterCase{"enum is one of", "moods", "", []cond{{"mood", db.FilterIn, []string{"happy", "meh"}}}, "id", []string{"1", "3"}},
			filterCase{"enum equals", "moods", "", []cond{{"mood", db.FilterEq, []string{"sad"}}}, "id", []string{"2"}},
		)
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			tbl := tableOf(t, p, c.table)
			req := db.RowsRequest{Table: tbl, Limit: 50, Search: c.search, SortDir: db.SortAsc}
			id := fieldOf(t, tbl, "id")
			req.Sort = &id
			for _, cd := range c.conds {
				req.Filters = append(req.Filters, db.Filter{Field: fieldOf(t, tbl, cd.col), Op: cd.op, Values: cd.values})
			}
			_, rows, total, err := p.FetchRows(context.Background(), req)
			if err != nil {
				t.Fatal(err)
			}
			var got []string
			for _, r := range rows {
				got = append(got, str(r[c.pick]))
			}
			if !slices.Equal(got, c.want) || total != int64(len(c.want)) {
				t.Fatalf("got %v (total %d), want %v", got, total, c.want)
			}
		})
	}
}
