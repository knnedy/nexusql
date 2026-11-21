// Package export renders an introspected schema as ORM and documentation
// formats. It builds one model (names, keys, both sides of every relation)
// and each format renders it; dialects supply only type and default facts.
package export

import (
	"slices"
	"strconv"
	"strings"

	"github.com/knnedy/nexusql/internal/db"
)

// Model is a schema prepared for rendering.
type Model struct {
	Dialect db.Exporter
	Tables  []*Table
	Enums   []*Enum
}

type Enum struct {
	Name   string // database name
	Ident  string
	Values []EnumValue
}

type EnumValue struct {
	Name  string // database value
	Ident string
}

type Table struct {
	Name      string // database name
	Ident     string
	Fields    []*Field
	PK        []*Field // in column order
	Out, In   []*Relation
	Unique    [][]*Field // referenced column sets other than the primary key
	identUsed map[string]bool
}

type Field struct {
	db.Field
	Ident string
	Enum  *Enum
}

// Relation is one foreign key, seen from both tables.
type Relation struct {
	Name           string // set when the pair of tables has several relations
	From           *Table
	FromFields     []*Field
	To             *Table
	ToFields       []*Field
	FromIdent      string // relation field on From
	ToIdent        string // back-relation field on To
	Optional       bool   // a source column is nullable
	OneToOne       bool   // the source columns are From's primary key
	ReferencesPK   bool
	ConstraintName string
}

// Build prepares schema for rendering, leaving out migration-tool tables.
func Build(schema *db.Schema, dialect db.Exporter) *Model {
	m := &Model{Dialect: dialect}
	enums := map[string]*Enum{}
	enumIdents := map[string]bool{}
	for _, e := range schema.Enums {
		en := &Enum{Name: e.Name, Ident: unique(ident(e.Name), enumIdents)}
		used := map[string]bool{}
		for _, v := range e.Values {
			en.Values = append(en.Values, EnumValue{Name: v, Ident: unique(ident(v), used)})
		}
		enums[e.Name] = en
		m.Enums = append(m.Enums, en)
	}

	tables := map[string]*Table{}
	tableIdents := map[string]bool{}
	for _, e := range m.Enums {
		tableIdents[e.Ident] = true // models and enums share one namespace
	}
	for _, t := range schema.Tables {
		if !db.IsUserTable(t.Name) {
			continue
		}
		tb := &Table{Name: t.Name, Ident: unique(ident(t.Name), tableIdents), identUsed: map[string]bool{}}
		for _, f := range t.Fields {
			fd := &Field{Field: f, Ident: unique(ident(f.Name), tb.identUsed), Enum: enums[string(f.Type)]}
			tb.Fields = append(tb.Fields, fd)
			if f.IsPrimaryKey {
				tb.PK = append(tb.PK, fd)
			}
		}
		tables[t.Name] = tb
		m.Tables = append(m.Tables, tb)
	}

	for _, r := range schema.Relations {
		from, to := tables[r.SourceTable], tables[r.TargetTable]
		if from == nil || to == nil {
			continue
		}
		src, dst := r.SourceFields, r.TargetFields
		if len(src) == 0 {
			src, dst = []string{r.SourceField}, []string{r.TargetField}
		}
		rel := &Relation{From: from, To: to, ConstraintName: r.ConstraintName}
		for i := range src {
			rel.FromFields = append(rel.FromFields, from.field(src[i]))
			rel.ToFields = append(rel.ToFields, to.field(dst[i]))
		}
		if slices.Contains(rel.FromFields, nil) || slices.Contains(rel.ToFields, nil) {
			continue
		}
		rel.Optional = slices.ContainsFunc(rel.FromFields, func(f *Field) bool { return f.Nullable })
		rel.OneToOne = sameSet(rel.FromFields, from.PK)
		rel.ReferencesPK = sameSet(rel.ToFields, to.PK)
		if !rel.ReferencesPK && !slices.ContainsFunc(to.Unique, func(u []*Field) bool { return sameSet(u, rel.ToFields) }) {
			to.Unique = append(to.Unique, rel.ToFields)
		}
		from.Out = append(from.Out, rel)
		to.In = append(to.In, rel)
	}
	nameRelations(m)
	return m
}

// nameRelations gives relation fields their names, and the relations
// themselves a name wherever two tables are linked more than once.
func nameRelations(m *Model) {
	pairs := map[[2]*Table]int{}
	key := func(r *Relation) [2]*Table {
		if r.From.Ident < r.To.Ident {
			return [2]*Table{r.From, r.To}
		}
		return [2]*Table{r.To, r.From}
	}
	for _, t := range m.Tables {
		for _, r := range t.Out {
			pairs[key(r)]++
		}
	}
	for _, t := range m.Tables {
		for _, r := range t.Out {
			base := r.To.Ident
			if len(r.FromFields) == 1 {
				if s, ok := strings.CutSuffix(r.FromFields[0].Name, "_id"); ok && s != "" {
					base = ident(s)
				}
			}
			r.FromIdent = unique(base, t.identUsed)
			if pairs[key(r)] > 1 || r.From == r.To {
				r.Name = t.Ident + "_" + r.FromIdent
			}
		}
	}
	for _, t := range m.Tables {
		for _, r := range t.In {
			base := r.From.Ident
			if r.Name != "" {
				base = r.Name
			}
			r.ToIdent = unique(base, t.identUsed)
		}
	}
}

func (t *Table) field(name string) *Field {
	for _, f := range t.Fields {
		if f.Name == name {
			return f
		}
	}
	return nil
}

func sameSet(a, b []*Field) bool {
	if len(a) != len(b) || len(a) == 0 {
		return false
	}
	for _, f := range a {
		if !slices.Contains(b, f) {
			return false
		}
	}
	return true
}

// ident turns a database name into an identifier valid in every target
// language: letters, digits and underscores, starting with a letter.
func ident(name string) string {
	var b strings.Builder
	for _, r := range name {
		switch {
		case r >= 'a' && r <= 'z', r >= 'A' && r <= 'Z', r >= '0' && r <= '9', r == '_':
			b.WriteRune(r)
		default:
			b.WriteByte('_')
		}
	}
	s := b.String()
	if s == "" || !(s[0] >= 'a' && s[0] <= 'z' || s[0] >= 'A' && s[0] <= 'Z') {
		s = "c" + s
	}
	return s
}

// unique returns base, or base with a number, not yet in used, and claims it.
func unique(base string, used map[string]bool) string {
	name := base
	for i := 2; used[name]; i++ {
		name = base + strconv.Itoa(i)
	}
	used[name] = true
	return name
}
