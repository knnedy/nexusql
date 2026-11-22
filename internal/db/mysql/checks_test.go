package mysql

import (
	"slices"
	"strings"
	"testing"
)

// CHECK_CLAUSE as MySQL 8.4 stores it: quotes backslash-escaped, with
// charset introducers; an unescaped clause is read the same way.
func TestAllowedFromClause(t *testing.T) {
	cases := []struct {
		clause, col string
		want        []string
	}{
		{"(`t` in (_utf8mb4\\'x\\',_utf8mb4\\'it\\\\\\'s\\',_utf8mb4\\'y z\\'))", "t", []string{"x", "it's", "y z"}},
		{"(`t` in (_utf8mb4'x',_utf8mb4'it\\'s'))", "t", []string{"x", "it's"}},
		{"(`Odd Name` in (_latin1\\'m\\',_latin1\\'n\\'))", "odd name", []string{"m", "n"}},
		{"(`one` = _utf8mb4\\'solo\\')", "ONE", []string{"solo"}},
		{"(`n` in (1,2))", "n", nil},
		{"((`r` in (_utf8mb4\\'a\\',_utf8mb4\\'b\\')) or (`r` is null))", "r", nil},
	}
	for _, c := range cases {
		col, got := allowedFromClause(c.clause)
		if c.want != nil && !strings.EqualFold(col, c.col) {
			t.Errorf("%s: column %q, want %q", c.clause, col, c.col)
		}
		if !slices.Equal(got, c.want) {
			t.Errorf("%s: got %q, want %q", c.clause, got, c.want)
		}
	}
}
