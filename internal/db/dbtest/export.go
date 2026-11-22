package dbtest

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"slices"
	"strings"
	"testing"

	"github.com/knnedy/nexusql/internal/db"
	"github.com/knnedy/nexusql/internal/export"
	"github.com/knnedy/nexusql/internal/sqlscan"
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
	m := export.Build(schema, dialect)
	golden(t, "testdata/export.prisma", export.Prisma(m))
	golden(t, "testdata/export.ts", export.Drizzle(m))
	golden(t, "testdata/export.dbml", export.DBML(m))
	golden(t, "testdata/export.mmd", export.Mermaid(m))
	ddl := export.SQL(m)
	golden(t, "testdata/export.sql", ddl)

	t.Run("the SQL export recreates the schema", func(t *testing.T) {
		fresh := h.Open(t)
		for _, s := range sqlscan.Split(ddl, fresh.Syntax()) {
			mustExec(t, fresh, s.Text)
		}
		again, err := fresh.IntrospectSchema(context.Background(), fresh.DefaultSchema())
		if err != nil {
			t.Fatal(err)
		}
		want, got := comparable(schema, dialect), comparable(again, dialect)
		if !reflect.DeepEqual(want, got) {
			w, _ := json.MarshalIndent(want, "", "  ")
			g, _ := json.MarshalIndent(got, "", "  ")
			t.Fatalf("schema after running the export differs\n%s", lineDiff(string(w), string(g)))
		}
	})
}

// comparable drops what a recreated schema may legitimately change: the
// database it is in, and SQLite's foreign key names, made up from position.
func comparable(s *db.Schema, dialect db.Exporter) *db.Schema {
	c := *s
	c.Tables = slices.Clone(s.Tables)
	for i := range c.Tables {
		c.Tables[i].Schema = ""
	}
	c.Relations = slices.Clone(s.Relations)
	if dialect.SQL().InlineForeignKeys {
		for i := range c.Relations {
			c.Relations[i].ConstraintName = ""
		}
	}
	slices.SortFunc(c.Relations, func(a, b db.Relation) int {
		return strings.Compare(a.SourceTable+"."+strings.Join(a.SourceFields, ","), b.SourceTable+"."+strings.Join(b.SourceFields, ","))
	})
	return &c
}

// lineDiff lists the lines of want and got that differ, by position.
func lineDiff(want, got string) string {
	w, g := strings.Split(want, "\n"), strings.Split(got, "\n")
	var out []string
	for i := range max(len(w), len(g)) {
		var a, b string
		if i < len(w) {
			a = w[i]
		}
		if i < len(g) {
			b = g[i]
		}
		if a != b {
			out = append(out, fmt.Sprintf("line %d:\n  want %s\n  got  %s", i+1, a, b))
		}
		if len(out) == 12 {
			break
		}
	}
	return strings.Join(out, "\n")
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
