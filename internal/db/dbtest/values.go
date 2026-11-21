package dbtest

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/knnedy/nexusql/internal/db"
)

// Values is a dialect's "vals" table: Setup creates it with one row, and Want
// maps each column to the JSON the browser must receive for it.
type Values struct {
	Setup []string
	Want  map[string]string
	// Stored maps SQL expressions to their value after edits, for dialects whose
	// storage class is invisible in the JSON (SQLite typeof).
	Stored map[string]string
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
		res, err := Script(context.Background(), p, "SELECT * FROM vals", 0)
		if err != nil || len(res.Rows) != 1 {
			t.Fatalf("rows %v err %v", res.Rows, err)
		}
		check(t, res.Rows[0])
	})
	t.Run("edits round-trip the shown text", func(t *testing.T) {
		tbl := tableOf(t, p, "vals")
		key := []db.KeyValue{{Field: fieldOf(t, tbl, "id"), Value: "1"}}
		for col, want := range h.Values.Want {
			var value *string
			if want != "null" {
				s := shownText(want)
				value = &s
			}
			if err := p.UpdateRow(context.Background(), tbl, key, fieldOf(t, tbl, col), value); err != nil {
				t.Errorf("%s: update with %s: %v", col, want, err)
			}
		}
		_, rows, _, err := page(t, p, "vals", 1, 0, "", "asc", "")
		if err != nil || len(rows) != 1 {
			t.Fatalf("rows %v err %v", rows, err)
		}
		check(t, rows[0])
		for expr, want := range h.Values.Stored {
			res, err := Script(context.Background(), p, "SELECT "+expr+" AS v FROM vals", 0)
			if err != nil || len(res.Rows) != 1 || str(res.Rows[0]["v"]) != want {
				t.Errorf("%s = %v (err %v), want %s", expr, res.Rows, err, want)
			}
		}
	})
}

// shownText is what the grid displays, and sends back, for a JSON cell value.
func shownText(wire string) string {
	var s string
	if json.Unmarshal([]byte(wire), &s) == nil {
		return s
	}
	return wire // numbers, booleans and JSON documents as written
}
