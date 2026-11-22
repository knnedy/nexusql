package dbtest

import (
	"context"
	"maps"
	"slices"
	"strings"
	"testing"

	"github.com/knnedy/nexusql/internal/db"
)

// Keys is a dialect's key fixture. Setup must create:
//   - parent(a, b) with PRIMARY KEY (a, b)
//   - child(id, pa, pb) with FOREIGN KEY (pa, pb) REFERENCES parent (a, b)
//
// plus the tables named in Auto, whose "table.column" entries say whether the
// database assigns that primary key itself.
type Keys struct {
	Setup []string
	Auto  map[string]bool
	PK    map[string]bool // optional extra "table.column" primary-key expectations
	// Identity and Monotonic are optional "table.column" expectations for those fields.
	Identity  map[string]db.Identity
	Monotonic map[string]bool
}

func testKeys(t *testing.T, h Harness) {
	if h.Keys.Setup == nil {
		t.Skip("harness has no key fixture")
	}
	p := h.Open(t)
	for _, stmt := range h.Keys.Setup {
		mustExec(t, p, stmt)
	}
	sch, err := p.IntrospectSchema(context.Background(), p.DefaultSchema())
	if err != nil {
		t.Fatal(err)
	}

	t.Run("unique constraints and unique indexes are listed", func(t *testing.T) {
		for _, stmt := range []string{
			`CREATE TABLE uniq (id INTEGER PRIMARY KEY, a INTEGER UNIQUE, b INTEGER, c INTEGER, UNIQUE (b, c))`,
			`CREATE UNIQUE INDEX uniq_c ON uniq (c)`,
			`CREATE INDEX uniq_plain ON uniq (b)`,
		} {
			mustExec(t, p, stmt)
		}
		s, err := p.IntrospectSchema(context.Background(), p.DefaultSchema())
		if err != nil {
			t.Fatal(err)
		}
		tbl, _ := s.Table("uniq")
		var got []string
		for _, u := range tbl.Unique {
			got = append(got, strings.Join(u, ","))
		}
		slices.Sort(got)
		if want := []string{"a", "b,c", "c"}; !slices.Equal(got, want) {
			t.Fatalf("unique sets = %v, want %v (primary key and plain indexes left out)", got, want)
		}
	})

	t.Run("plain indexes are listed by name", func(t *testing.T) {
		for _, stmt := range []string{
			`CREATE TABLE idx (id INTEGER PRIMARY KEY, a INTEGER, b INTEGER, c INTEGER)`,
			`CREATE INDEX idx_c ON idx (c)`,
			`CREATE INDEX idx_ab ON idx (a, b)`,
			`CREATE UNIQUE INDEX idx_u ON idx (b)`,
			`CREATE INDEX idx_expr ON idx (c, (a + 1))`,
		} {
			mustExec(t, p, stmt)
		}
		s, err := p.IntrospectSchema(context.Background(), p.DefaultSchema())
		if err != nil {
			t.Fatal(err)
		}
		tbl, _ := s.Table("idx")
		var got []string
		for _, ix := range tbl.Indexes {
			got = append(got, ix.Name+":"+strings.Join(ix.Columns, ","))
		}
		if want := []string{"idx_ab:a,b", "idx_c:c"}; !slices.Equal(got, want) {
			t.Fatalf("indexes = %v, want %v (unique and expression indexes left out)", got, want)
		}
	})

	t.Run("referential actions are read per foreign key", func(t *testing.T) {
		for _, stmt := range []string{
			`CREATE TABLE ra_parent (id INTEGER PRIMARY KEY)`,
			`CREATE TABLE ra_child (id INTEGER PRIMARY KEY, c INTEGER, d INTEGER, e INTEGER,
				FOREIGN KEY (c) REFERENCES ra_parent (id) ON DELETE CASCADE ON UPDATE SET NULL,
				FOREIGN KEY (d) REFERENCES ra_parent (id) ON DELETE SET NULL ON UPDATE RESTRICT,
				FOREIGN KEY (e) REFERENCES ra_parent (id))`,
		} {
			mustExec(t, p, stmt)
		}
		s, err := p.IntrospectSchema(context.Background(), p.DefaultSchema())
		if err != nil {
			t.Fatal(err)
		}
		got := map[string]string{}
		for _, r := range s.Relations {
			if r.SourceTable == "ra_child" {
				got[r.SourceField] = string(r.OnDelete) + "/" + string(r.OnUpdate)
			}
		}
		want := map[string]string{"c": "CASCADE/SET NULL", "d": "SET NULL/RESTRICT", "e": "NO ACTION/NO ACTION"}
		if !maps.Equal(got, want) {
			t.Fatalf("actions = %v, want %v", got, want)
		}
	})

	t.Run("composite foreign key is one relation with ordered column pairs", func(t *testing.T) {
		var found []db.Relation
		for _, r := range sch.Relations {
			if r.SourceTable == "child" {
				found = append(found, r)
			}
		}
		if len(found) != 1 {
			t.Fatalf("child relations = %+v, want exactly one", found)
		}
		r := found[0]
		if r.TargetTable != "parent" || !slices.Equal(r.SourceFields, []string{"pa", "pb"}) ||
			!slices.Equal(r.TargetFields, []string{"a", "b"}) || !r.IsComposite() {
			t.Fatalf("relation = %+v, want child(pa, pb) -> parent(a, b)", r)
		}
		if r.SourceField != "pa" || r.TargetField != "a" {
			t.Fatalf("first pair = %s -> %s, want pa -> a", r.SourceField, r.TargetField)
		}
	})

	t.Run("single-column relations list their pair too", func(t *testing.T) {
		p := setup(t, h)
		s, err := p.IntrospectSchema(context.Background(), p.DefaultSchema())
		if err != nil {
			t.Fatal(err)
		}
		for _, r := range s.Relations {
			if r.SourceTable == "posts" && (!slices.Equal(r.SourceFields, []string{"user_id"}) ||
				!slices.Equal(r.TargetFields, []string{"id"}) || r.IsComposite()) {
				t.Fatalf("posts relation = %+v", r)
			}
		}
	})

	t.Run("composite key columns are primary and foreign keys", func(t *testing.T) {
		parent, _ := sch.Table("parent")
		child, _ := sch.Table("child")
		for _, c := range []struct {
			tbl    db.Table
			col    string
			pk, fk bool
		}{{parent, "a", true, false}, {parent, "b", true, false}, {child, "pa", false, true}, {child, "pb", false, true}, {child, "id", true, false}} {
			f := fieldOf(t, c.tbl, c.col)
			if f.IsPrimaryKey != c.pk || f.IsForeignKey != c.fk {
				t.Errorf("%s.%s: pk=%v fk=%v, want pk=%v fk=%v", c.tbl.Name, c.col, f.IsPrimaryKey, f.IsForeignKey, c.pk, c.fk)
			}
		}
	})

	t.Run("primary-key flags", func(t *testing.T) {
		for name, want := range h.Keys.PK {
			tblName, col, _ := cut(name)
			tbl, _ := sch.Table(tblName)
			if f := fieldOf(t, tbl, col); f.IsPrimaryKey != want {
				t.Errorf("%s: IsPrimaryKey = %v, want %v", name, f.IsPrimaryKey, want)
			}
		}
	})

	t.Run("identity kind and never-reused keys are reported", func(t *testing.T) {
		if h.Keys.Identity == nil && h.Keys.Monotonic == nil {
			t.Skip("dialect has neither")
		}
		testGeneration(t, h, sch)
	})

	t.Run("auto-generated keys are flagged, not faked as defaults", func(t *testing.T) {
		for name, want := range h.Keys.Auto {
			tblName, col, _ := cut(name)
			tbl, ok := sch.Table(tblName)
			if !ok {
				t.Fatalf("table %s missing", tblName)
			}
			f := fieldOf(t, tbl, col)
			if f.AutoGenerated != want {
				t.Errorf("%s: AutoGenerated = %v, want %v", name, f.AutoGenerated, want)
			}
			if want && (f.Nullable || (f.DefaultValue != nil && !isSequenceDefault(*f.DefaultValue))) {
				t.Errorf("%s: nullable=%v default=%v, want NOT NULL and no fake default", name, f.Nullable, *f.DefaultValue)
			}
		}
	})
}

func testGeneration(t *testing.T, h Harness, sch *db.Schema) {
	field := func(name string) db.Field {
		tblName, col, _ := cut(name)
		tbl, ok := sch.Table(tblName)
		if !ok {
			t.Fatalf("table %s missing", tblName)
		}
		return fieldOf(t, tbl, col)
	}
	for name, want := range h.Keys.Identity {
		if got := field(name).Identity; got != want {
			t.Errorf("%s: Identity = %q, want %q", name, got, want)
		}
	}
	for name, want := range h.Keys.Monotonic {
		if got := field(name).Monotonic; got != want {
			t.Errorf("%s: Monotonic = %v, want %v", name, got, want)
		}
	}
}

func cut(s string) (string, string, bool) {
	for i := range s {
		if s[i] == '.' {
			return s[:i], s[i+1:], true
		}
	}
	return s, "", false
}

// isSequenceDefault allows the real default Postgres reports for serial columns.
func isSequenceDefault(d string) bool {
	return len(d) > 8 && d[:8] == "nextval("
}
