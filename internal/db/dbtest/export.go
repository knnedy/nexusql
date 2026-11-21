package dbtest

import (
	"context"
	"flag"
	"os"
	"path/filepath"
	"testing"

	"github.com/knnedy/nexusql/internal/db"
	"github.com/knnedy/nexusql/internal/export"
)

var updateGolden = flag.Bool("update", false, "rewrite export golden files in testdata/")

// Export is a schema exercising every exported shape: two keys into one
// table, a self-reference, text and composite primary keys, a join table, a
// composite foreign key, a key referencing a unique column, a table without
// a key, a name that is not an identifier, enums and defaults. The output is
// compared with testdata/export.*, which tools/exportcheck validates.
type Export struct {
	Setup []string
}

func testExport(t *testing.T, h Harness) {
	if h.Export.Setup == nil {
		t.Skip("harness has no export fixture")
	}
	p := h.Open(t)
	for _, stmt := range h.Export.Setup {
		mustExec(t, p, stmt)
	}
	schema, err := p.IntrospectSchema(context.Background(), p.DefaultSchema())
	if err != nil {
		t.Fatal(err)
	}
	dialect, err := db.ExporterFor(p.Kind())
	if err != nil {
		t.Fatal(err)
	}
	golden(t, "testdata/export.prisma", export.Prisma(export.Build(schema, dialect)))
}

func golden(t *testing.T, path, got string) {
	t.Helper()
	if *updateGolden {
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, []byte(got), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	want, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("%v (run with -update to create it)", err)
	}
	if got != string(want) {
		t.Errorf("%s differs from the export (run with -update after checking):\n%s", path, got)
	}
}
