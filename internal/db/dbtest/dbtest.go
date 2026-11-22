// Package dbtest is the conformance suite every db.Provider must pass.
// Each dialect runs it from its own _test.go file with a Harness.
package dbtest

import (
	"context"
	"fmt"
	"testing"

	"github.com/knnedy/nexusql/internal/db"
	"github.com/knnedy/nexusql/internal/sqlscan"
)

// Harness adapts one dialect to the suite.
type Harness struct {
	// Open connects to a fresh, empty database and registers cleanup on t.
	Open func(t *testing.T) db.Provider
	// Schema is the dialect's DDL for the fixture tables described in fixture.go.
	Schema []string
	// Values exercises how column values are encoded for the browser.
	Values Values
	// Keys exercises composite and auto-generated key introspection.
	Keys Keys
	// Seed exercises the seeder on constrained tables.
	Seed Seed
	// Columns pins declared types and default expressions.
	Columns Columns
	// Export is the schema whose exports are compared with testdata/.
	Export Export
}

// Run executes every conformance test against the harness.
func Run(t *testing.T, h Harness) {
	t.Run("Introspection", func(t *testing.T) { testIntrospection(t, h) })
	t.Run("Rows", func(t *testing.T) { testRows(t, h) })
	t.Run("Update", func(t *testing.T) { testUpdate(t, h) })
	t.Run("Query", func(t *testing.T) { testQuery(t, h) })
	t.Run("Seed", func(t *testing.T) { testSeed(t, h) })
	t.Run("SeedConstraints", func(t *testing.T) { testSeedConstraints(t, h) })
	t.Run("SeedLinks", func(t *testing.T) { testSeedLinks(t, h) })
	t.Run("Export", func(t *testing.T) { testExport(t, h) })
	t.Run("Quoting", func(t *testing.T) { testQuoting(t, h) })
	t.Run("Values", func(t *testing.T) { testValues(t, h) })
	t.Run("Keys", func(t *testing.T) { testKeys(t, h) })
	t.Run("Columns", func(t *testing.T) { testColumns(t, h) })
	t.Run("Checks", func(t *testing.T) { testChecks(t, h) })
}

// setup opens a fresh database with the fixture schema and rows loaded.
func setup(t *testing.T, h Harness) db.Provider {
	t.Helper()
	p := h.Open(t)
	for _, stmt := range append(append([]string{}, h.Schema...), fixtureRows...) {
		mustExec(t, p, stmt)
	}
	return p
}

func mustExec(t *testing.T, p db.Provider, sql string) {
	t.Helper()
	if _, err := Script(context.Background(), p, sql, 0); err != nil {
		t.Fatalf("exec %q: %v", sql, err)
	}
}

// Script runs console SQL the way studio does: split with the provider's syntax.
func Script(ctx context.Context, p db.Provider, sql string, maxRows int) (db.QueryResult, error) {
	return p.ExecuteScript(ctx, sqlscan.Split(sql, p.Syntax()), db.ScriptOptions{MaxRows: maxRows})
}

// str renders a scanned value dialect-neutrally (int32 vs int64, []byte vs string).
func str(v any) string {
	if b, ok := v.([]byte); ok {
		return string(b)
	}
	return fmt.Sprint(v)
}

// tableOf introspects p and returns the named table, as studio resolves it.
func tableOf(t *testing.T, p db.Provider, name string) db.Table {
	t.Helper()
	sch, err := p.IntrospectSchema(context.Background(), p.DefaultSchema())
	if err != nil {
		t.Fatal(err)
	}
	tbl, ok := sch.Table(name)
	if !ok {
		t.Fatalf("table %q not introspected", name)
	}
	return tbl
}

// fieldOf returns the named column of tbl.
func fieldOf(t *testing.T, tbl db.Table, name string) db.Field {
	t.Helper()
	f, ok := tbl.Field(name)
	if !ok {
		t.Fatalf("column %q not in %s", name, tbl.Name)
	}
	return f
}

// page fetches rows of a named table, sorted by sortCol when it is non-empty.
func page(t *testing.T, p db.Provider, table string, limit, offset int, sortCol string, dir db.SortDir, search string) ([]string, []map[string]any, int64, error) {
	t.Helper()
	tbl := tableOf(t, p, table)
	req := db.RowsRequest{Table: tbl, Limit: limit, Offset: offset, SortDir: dir, Search: search}
	if sortCol != "" {
		f := fieldOf(t, tbl, sortCol)
		req.Sort = &f
	}
	return p.FetchRows(context.Background(), req)
}

// lookup runs FetchRowWhere on named identifiers.
func lookup(t *testing.T, p db.Provider, table, field, value string) ([]string, []map[string]any, error) {
	t.Helper()
	tbl := tableOf(t, p, table)
	return p.FetchRowWhere(context.Background(), tbl, fieldOf(t, tbl, field), value)
}

// update runs UpdateRow on named identifiers.
func update(t *testing.T, p db.Provider, table, pk, pkValue, target, value string) error {
	t.Helper()
	tbl := tableOf(t, p, table)
	key := []db.KeyValue{{Field: fieldOf(t, tbl, pk), Value: pkValue}}
	return p.UpdateRow(context.Background(), tbl, key, fieldOf(t, tbl, target), &value)
}
