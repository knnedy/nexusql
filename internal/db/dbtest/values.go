package dbtest

import (
	"context"
	"encoding/json"
	"testing"
)

// Values is a dialect's "vals" table: Setup creates it with one row, and Want
// maps each column to the JSON the browser must receive for it.
type Values struct {
	Setup []string
	Want  map[string]string
}

func testValues(t *testing.T, h Harness) {
	if h.Values.Setup == nil {
		t.Skip("harness has no value fixture")
	}
	p := h.Open(t)
	for _, stmt := range h.Values.Setup {
		mustExec(t, p, stmt)
	}

	check := func(t *testing.T, row map[string]any) {
		t.Helper()
		for col, want := range h.Values.Want {
			got, err := json.Marshal(row[col])
			if err != nil {
				t.Errorf("%s: cannot encode %#v: %v", col, row[col], err)
				continue
			}
			if string(got) != want {
				t.Errorf("%s: got %s (%T), want %s", col, got, row[col], want)
			}
		}
	}

	t.Run("rows", func(t *testing.T) {
		_, rows, _, err := page(t, p, "vals", 1, 0, "", "asc", "")
		if err != nil || len(rows) != 1 {
			t.Fatalf("rows %v err %v", rows, err)
		}
		check(t, rows[0])
	})
	t.Run("console", func(t *testing.T) {
		_, rows, _, _, err := p.ExecuteQuery(context.Background(), "SELECT * FROM vals")
		if err != nil || len(rows) != 1 {
			t.Fatalf("rows %v err %v", rows, err)
		}
		check(t, rows[0])
	})
}
