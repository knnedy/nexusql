package dbtest

import (
	"context"
	"slices"
	"strings"
	"testing"
)

// testChecks: a single-column CHECK that lists string values (IN, or = for one)
// fills Field.Allowed; any other shape leaves it empty.
func testChecks(t *testing.T, h Harness) {
	p := h.Open(t)
	mustExec(t, p, `CREATE TABLE chk (id INTEGER PRIMARY KEY,
		t VARCHAR(20) CHECK (t IN ('x', 'it''s', 'y z')),
		one VARCHAR(10) CHECK (one IN ('solo')),
		eq VARCHAR(10) CHECK (eq = 'only'),
		n INTEGER CHECK (n IN (1, 2)),
		r VARCHAR(10) CHECK (r IN ('a', 'b') OR r IS NULL),
		w VARCHAR(10),
		CHECK (w IN ('k', 'l')))`)
	sch, err := p.IntrospectSchema(context.Background(), p.DefaultSchema())
	if err != nil {
		t.Fatal(err)
	}
	tbl, ok := sch.Table("chk")
	if !ok {
		t.Fatal("table chk missing")
	}
	want := map[string][]string{
		"t": {"x", "it's", "y z"}, "one": {"solo"}, "eq": {"only"}, "w": {"k", "l"},
		"id": nil, "n": nil, "r": nil,
	}
	for col, vals := range want {
		if got := fieldOf(t, tbl, col).Allowed; !slices.Equal(got, vals) {
			t.Errorf("%s: Allowed = %q, want %q", col, got, vals)
		}
	}

	t.Run("every check constraint is listed with its expression", func(t *testing.T) {
		mustExec(t, p, `CREATE TABLE chk2 (id INTEGER PRIMARY KEY, n INTEGER, m INTEGER CHECK (m < 10),
			CONSTRAINT positive CHECK (n > 0), CONSTRAINT ordered CHECK (n <= m))`)
		sch, err := p.IntrospectSchema(context.Background(), p.DefaultSchema())
		if err != nil {
			t.Fatal(err)
		}
		tbl, _ := sch.Table("chk2")
		if len(tbl.Checks) != 3 {
			t.Fatalf("checks = %+v, want 3", tbl.Checks)
		}
		byName := map[string]string{}
		for _, c := range tbl.Checks {
			byName[c.Name] = c.Expr
		}
		for name, parts := range map[string][]string{"positive": {"n", ">", "0"}, "ordered": {"n", "<=", "m"}} {
			for _, part := range parts {
				if !strings.Contains(byName[name], part) {
					t.Errorf("%s: expr %q lacks %q", name, byName[name], part)
				}
			}
		}
	})
}
