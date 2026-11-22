package dbtest

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"reflect"
	"regexp"
	"slices"
	"strings"
	"testing"

	"github.com/knnedy/nexusql/internal/db"
	"github.com/knnedy/nexusql/internal/export"
	"github.com/knnedy/nexusql/internal/sqlscan"
)

var gormCheckName = regexp.MustCompile(`^[\w-]+$`)

var (
	updateGolden = flag.Bool("update", false, "rewrite export golden files in testdata/")
	exportCheck  = flag.Bool("exportcheck", false, "also run exports through their tools (make export-check)")
)

// Export is a schema exercising every exported shape: two keys into one
// table, a self-reference, text and composite primary keys, a join table, a
// composite foreign key, a key referencing a unique column, a table without
// a key, a name that is not an identifier, enums and defaults. The output is
// compared with testdata/export.*, which tools/exportcheck validates.
type Export struct {
	Setup []string
	// TypeORMLimits rewrites the schema into what TypeORM's synchronize can create
	// on the dialect; each change must be a documented TypeORM limitation.
	TypeORMLimits func(want, got *db.Schema)
	// GORMLimits does the same for GORM's AutoMigrate.
	GORMLimits func(want, got *db.Schema)
}

// ClearCheckNames blanks CHECK names in each schema, for tools that make them up.
func ClearCheckNames(schemas ...*db.Schema) {
	for _, s := range schemas {
		for i := range s.Tables {
			for j := range s.Tables[i].Checks {
				s.Tables[i].Checks[j].Name = ""
			}
		}
	}
}

// EachField calls fn on every field of want, for TypeORMLimits.
func EachField(s *db.Schema, fn func(t *db.Table, f *db.Field)) {
	for i := range s.Tables {
		for j := range s.Tables[i].Fields {
			fn(&s.Tables[i], &s.Tables[i].Fields[j])
		}
	}
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
	golden(t, "testdata/export.kysely.ts", export.Kysely(m))
	golden(t, "testdata/export.typeorm.ts", export.TypeORM(m))
	golden(t, "testdata/export.gorm.go", export.GORM(m))
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
		sameSchema(t, comparable(schema, dialect), comparable(again, dialect))
	})

	t.Run("TypeORM's synchronize recreates the schema", func(t *testing.T) {
		if !*exportCheck || h.URI == nil {
			t.Skip("runs under make export-check")
		}
		src := filepath.Join(t.TempDir(), "entities.ts")
		if err := os.WriteFile(src, []byte(export.TypeORM(m)), 0o644); err != nil {
			t.Fatal(err)
		}
		uri := h.URI(t)
		cmd := exec.Command("node", "../../../tools/exportcheck/typeorm-sync.mjs", string(p.Kind()), uri, src)
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("typeorm-sync: %v\n%s", err, out)
		}
		fresh := h.Connect(t, uri)
		again, err := fresh.IntrospectSchema(context.Background(), fresh.DefaultSchema())
		if err != nil {
			t.Fatal(err)
		}
		want, got := comparable(keyed(schema), dialect), comparable(again, dialect)
		if h.Export.TypeORMLimits != nil {
			h.Export.TypeORMLimits(want, got)
		}
		sameSchema(t, want, got)
	})

	t.Run("GORM's AutoMigrate recreates the schema", func(t *testing.T) {
		if !*exportCheck || h.URI == nil {
			t.Skip("runs under make export-check")
		}
		kind := string(p.Kind())
		dir := filepath.Join("../../../tools/gormcheck/out", kind)
		if err := os.RemoveAll(dir); err != nil {
			t.Fatal(err)
		}
		if err := os.MkdirAll(filepath.Join(dir, "models"), 0o755); err != nil {
			t.Fatal(err)
		}
		mainGo := "package main\n\nimport (\n\t\"gormcheck\"\n\t\"gormcheck/out/" + kind + "/models\"\n)\n\nfunc main() { gormcheck.Main(models.Models()...) }\n"
		for path, src := range map[string]string{"main.go": mainGo, "models/models.go": export.GORM(m)} {
			if err := os.WriteFile(filepath.Join(dir, path), []byte(src), 0o644); err != nil {
				t.Fatal(err)
			}
		}
		uri := h.URI(t)
		fresh := h.Connect(t, uri)
		// AutoMigrate cannot create enum types; the export lists them for this.
		for _, s := range sqlscan.Split(ddl, fresh.Syntax()) {
			if strings.Contains(s.Text, "CREATE TYPE ") && !strings.Contains(s.Text, "CREATE TABLE") {
				mustExec(t, fresh, s.Text)
			}
		}
		cmd := exec.Command("go", "run", "./out/"+kind, kind, uri)
		cmd.Dir = "../../../tools/gormcheck"
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("gormcheck: %v\n%s", err, out)
		}
		again, err := fresh.IntrospectSchema(context.Background(), fresh.DefaultSchema())
		if err != nil {
			t.Fatal(err)
		}
		want, got := comparable(schema, dialect), comparable(again, dialect)
		// GORM names foreign keys itself (fk_<owner>_<field>), with no tag to set them,
		// and reads a CHECK name other than [\w-]+ as expression: it becomes chk_<table>_<field>.
		for _, s := range []*db.Schema{want, got} {
			for i := range s.Relations {
				s.Relations[i].ConstraintName = ""
			}
		}
		for i, tb := range want.Tables {
			for j, c := range tb.Checks {
				if !gormCheckName.MatchString(c.Name) {
					want.Tables[i].Checks[j].Name = "chk_" + tb.Name + "_" + tb.Fields[j].Name
				}
			}
		}
		if h.Export.GORMLimits != nil {
			h.Export.GORMLimits(want, got)
		}
		sameSchema(t, want, got)
	})
}

func sameSchema(t *testing.T, want, got *db.Schema) {
	t.Helper()
	for _, s := range []*db.Schema{want, got} {
		for i := range s.Tables {
			slices.SortFunc(s.Tables[i].Checks, func(a, b db.Check) int { return strings.Compare(a.Name, b.Name) })
		}
	}
	if !reflect.DeepEqual(want, got) {
		w, _ := json.MarshalIndent(want, "", "  ")
		g, _ := json.MarshalIndent(got, "", "  ")
		t.Fatalf("recreated schema differs\n%s", lineDiff(string(w), string(g)))
	}
}

// keyed drops tables without a primary key, which TypeORM cannot map.
func keyed(s *db.Schema) *db.Schema {
	c := *s
	c.Tables = slices.DeleteFunc(deepTables(s.Tables), func(t db.Table) bool {
		return !slices.ContainsFunc(t.Fields, func(f db.Field) bool { return f.IsPrimaryKey })
	})
	return &c
}

// comparable drops what a recreated schema may legitimately change: the
// database it is in, and SQLite's foreign key names, made up from position.
func comparable(s *db.Schema, dialect db.Exporter) *db.Schema {
	c := *s
	c.Tables = deepTables(s.Tables)
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

// deepTables copies tables so a TypeORMLimits rewrite leaves the original alone.
func deepTables(ts []db.Table) []db.Table {
	out := slices.Clone(ts)
	for i := range out {
		out[i].Fields = slices.Clone(out[i].Fields)
		out[i].Checks = slices.Clone(out[i].Checks)
	}
	return out
}

// lineDiff lists the lines only want (-) or only got (+) has, by longest
// common subsequence, each with the nearest preceding "name" for context.
func lineDiff(want, got string) string {
	w, g := strings.Split(want, "\n"), strings.Split(got, "\n")
	lcs := make([][]int, len(w)+1)
	for i := range lcs {
		lcs[i] = make([]int, len(g)+1)
	}
	for i := len(w) - 1; i >= 0; i-- {
		for j := len(g) - 1; j >= 0; j-- {
			if w[i] == g[j] {
				lcs[i][j] = lcs[i+1][j+1] + 1
			} else {
				lcs[i][j] = max(lcs[i+1][j], lcs[i][j+1])
			}
		}
	}
	var out []string
	name := ""
	note := func(sign, line string) {
		if len(out) < 150 {
			out = append(out, fmt.Sprintf("%s %-40s (near %s)", sign, strings.TrimSpace(line), name))
		}
	}
	i, j := 0, 0
	for i < len(w) || j < len(g) {
		switch {
		case i < len(w) && j < len(g) && w[i] == g[j]:
			if s := strings.TrimSpace(w[i]); strings.HasPrefix(s, `"name"`) {
				name = s
			}
			i, j = i+1, j+1
		case j < len(g) && (i == len(w) || lcs[i][j+1] >= lcs[i+1][j]):
			note("+", g[j])
			j++
		default:
			note("-", w[i])
			i++
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
