package dbtest

import (
	"context"
	"testing"
)

// Columns pins how a dialect reports declared types and defaults. Setup
// creates table d(id, title varchar(20) DEFAULT 'it”s', n integer DEFAULT 5,
// at timestamp DEFAULT CURRENT_TIMESTAMP, price decimal(10,2) DEFAULT 1.50).
type Columns struct {
	Setup []string
	// Want maps column -> {declared type, default as a SQL expression}.
	Want map[string][2]string
}

func testColumns(t *testing.T, h Harness) {
	if h.Columns.Setup == nil {
		t.Skip("harness has no column fixture")
	}
	p := h.Open(t)
	for _, stmt := range h.Columns.Setup {
		mustExec(t, p, stmt)
	}
	sch, err := p.IntrospectSchema(context.Background(), p.DefaultSchema())
	if err != nil {
		t.Fatal(err)
	}
	tbl, ok := sch.Table("d")
	if !ok {
		t.Fatal("table d not introspected")
	}
	for _, f := range tbl.Fields {
		want, ok := h.Columns.Want[f.Name]
		if !ok {
			continue
		}
		def := "<none>"
		if f.DefaultValue != nil {
			def = *f.DefaultValue
		}
		if f.NativeType != want[0] || def != want[1] {
			t.Errorf("%s: type %q default %q, want %q and %q", f.Name, f.NativeType, def, want[0], want[1])
		}
	}
}
