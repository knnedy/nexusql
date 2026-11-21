// Package dbtest is the conformance suite every db.Provider must pass.
// Each dialect runs it from its own _test.go file with a Harness.
package dbtest

import (
	"context"
	"fmt"
	"testing"

	"github.com/knnedy/nexusql/internal/db"
)

// Harness adapts one dialect to the suite.
type Harness struct {
	// Open connects to a fresh, empty database and registers cleanup on t.
	Open func(t *testing.T) db.Provider
	// Schema is the dialect's DDL for the fixture tables described in fixture.go.
	Schema []string
}

// Run executes every conformance test against the harness.
func Run(t *testing.T, h Harness) {
	t.Run("Introspection", func(t *testing.T) { testIntrospection(t, h) })
	t.Run("Rows", func(t *testing.T) { testRows(t, h) })
	t.Run("Update", func(t *testing.T) { testUpdate(t, h) })
	t.Run("Query", func(t *testing.T) { testQuery(t, h) })
	t.Run("Seed", func(t *testing.T) { testSeed(t, h) })
	t.Run("Export", func(t *testing.T) { testExport(t, h) })
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
	if _, _, _, _, err := p.ExecuteQuery(context.Background(), sql); err != nil {
		t.Fatalf("exec %q: %v", sql, err)
	}
}

// str renders a scanned value dialect-neutrally (int32 vs int64, []byte vs string).
func str(v any) string {
	if b, ok := v.([]byte); ok {
		return string(b)
	}
	return fmt.Sprint(v)
}
