package postgres

import (
	"slices"
	"testing"
)

// Definitions as pg_get_constraintdef prints them (Postgres 17).
func TestAllowedFromDefinition(t *testing.T) {
	cases := []struct {
		def, col string
		want     []string
	}{
		{`CHECK ((t = ANY (ARRAY['x'::text, 'it''s'::text, 'y z'::text])))`, "t", []string{"x", "it's", "y z"}},
		{`CHECK (((v)::text = ANY ((ARRAY['a'::character varying, 'b'::character varying])::text[])))`, "v", []string{"a", "b"}},
		{`CHECK (("Odd Name" = ANY (ARRAY['m'::text, 'n'::text])))`, "Odd Name", []string{"m", "n"}},
		{`CHECK ((one = 'solo'::text))`, "one", []string{"solo"}},
		{`CHECK ((n = ANY (ARRAY[1, 2])))`, "n", nil},
		{`CHECK (((r = ANY (ARRAY['a'::text, 'b'::text])) OR (r IS NULL)))`, "r", nil},
		{`CHECK ((t = ANY (ARRAY['x'::text])))`, "other", nil},
	}
	for _, c := range cases {
		if got := allowedFromDefinition(c.def, c.col); !slices.Equal(got, c.want) {
			t.Errorf("%s: got %q, want %q", c.def, got, c.want)
		}
	}
}
