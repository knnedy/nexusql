package dbtest

import (
	"testing"

	"github.com/knnedy/nexusql/internal/db"
)

// awkward needs quoting in every dialect: a space plus both quote characters.
const awkward = "line \"items\" `x`"

func testQuoting(t *testing.T, h Harness) {
	p := h.Open(t)
	mustExec(t, p, "CREATE TABLE "+p.QuoteIdentifier(awkward)+" (id INTEGER PRIMARY KEY, "+
		p.QuoteIdentifier("odd \"col\"")+" VARCHAR(20))")
	mustExec(t, p, "INSERT INTO "+p.QuoteIdentifier(awkward)+" VALUES (1, 'v')")

	_, rows, total, err := page(t, p, awkward, 10, 0, "odd \"col\"", db.SortAsc, "v")
	if err != nil {
		t.Fatalf("FetchRows: %v", err)
	}
	if total != 1 || len(rows) != 1 || str(rows[0]["odd \"col\""]) != "v" {
		t.Fatalf("got total %d rows %v, want the one row", total, rows)
	}
}
