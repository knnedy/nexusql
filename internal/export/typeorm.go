package export

import (
	"fmt"
	"slices"
	"strconv"
	"strings"

	"github.com/knnedy/nexusql/internal/db"
)

// typeormDecorators are the names the file imports; classes avoid them.
var typeormDecorators = []string{"Check", "Column", "Entity", "Generated", "Index", "JoinColumn",
	"ManyToOne", "OneToMany", "OneToOne", "PrimaryColumn", "PrimaryGeneratedColumn", "Relation", "Unique"}

// TypeORM renders m as TypeORM entity classes, one per table, with columns,
// keys, indexes, checks and both sides of every relation.
func TypeORM(m *Model) string {
	used := map[string]bool{}
	for _, d := range typeormDecorators {
		used[d] = true
	}
	enums := map[*Enum]string{}
	for _, e := range m.Enums {
		enums[e] = unique(pascal(e.Ident), used)
	}
	classes := map[*Table]string{}
	for _, t := range m.Tables {
		classes[t] = unique(pascal(t.Ident), used)
	}

	imports := map[string]bool{"Entity": true}
	var body strings.Builder
	for _, e := range m.Enums {
		vals := make([]string, len(e.Values))
		for i, v := range e.Values {
			vals[i] = db.JSString(v.Name)
		}
		fmt.Fprintf(&body, "\nexport type %s = %s;\n", enums[e], strings.Join(vals, " | "))
	}
	for _, t := range m.Tables {
		if len(t.PK) == 0 {
			fmt.Fprintf(&body, "\n// %s has no primary key, which every TypeORM entity needs.\n", t.Name)
			continue
		}
		w := &typeormTable{m: m, t: t, classes: classes, enums: enums, imports: imports, b: &body}
		w.write()
	}

	list := make([]string, 0, len(imports))
	for name := range imports {
		if name == "Relation" {
			name = "type Relation"
		}
		list = append(list, name)
	}
	slices.SortFunc(list, func(a, b string) int {
		return strings.Compare(strings.TrimPrefix(a, "type "), strings.TrimPrefix(b, "type "))
	})
	return fmt.Sprintf("import { %s } from 'typeorm';\n", strings.Join(list, ", ")) + body.String()
}

type typeormTable struct {
	m       *Model
	t       *Table
	classes map[*Table]string
	enums   map[*Enum]string
	imports map[string]bool
	b       *strings.Builder
}

func (w *typeormTable) use(name string) string {
	w.imports[name] = true
	return name
}

func (w *typeormTable) write() {
	t := w.t
	fmt.Fprintf(w.b, "\n@%s({ name: %s })\n", w.use("Entity"), db.JSString(t.Name))
	for _, u := range t.DeclaredUnique {
		if len(u) > 1 {
			fmt.Fprintf(w.b, "@%s([%s])\n", w.use("Unique"), typeormProps(u))
		}
	}
	for _, ix := range t.Indexes {
		fmt.Fprintf(w.b, "@%s(%s, [%s])\n", w.use("Index"), db.JSString(ix.Name), typeormProps(ix.Fields))
	}
	for _, c := range t.Checks {
		if c.Name != "" {
			fmt.Fprintf(w.b, "@%s(%s, %s)\n", w.use("Check"), db.JSString(c.Name), db.JSString(c.Expr))
		} else {
			fmt.Fprintf(w.b, "@%s(%s)\n", w.use("Check"), db.JSString(c.Expr))
		}
	}
	fmt.Fprintf(w.b, "export class %s {\n", w.classes[t])
	for i, f := range t.Fields {
		if i > 0 {
			w.b.WriteString("\n")
		}
		w.field(f)
	}
	for _, r := range t.Out {
		if len(r.To.PK) == 0 {
			continue
		}
		w.b.WriteString("\n")
		kind := "ManyToOne"
		if r.OneToOne {
			kind = "OneToOne"
		}
		var opts []string
		for _, a := range []struct {
			name string
			got  db.RefAction
		}{{"onDelete", r.OnDelete}, {"onUpdate", r.OnUpdate}} {
			if a.got != "" && a.got != db.NoAction {
				opts = append(opts, a.name+": "+db.JSString(string(a.got)))
			}
		}
		optStr := ""
		if len(opts) > 0 {
			optStr = ", { " + strings.Join(opts, ", ") + " }"
		}
		fmt.Fprintf(w.b, "  @%s(() => %s, (t) => t.%s%s)\n", w.use(kind), w.classes[r.To], r.ToIdent, optStr)
		fmt.Fprintf(w.b, "  @%s(%s)\n", w.use("JoinColumn"), w.joinColumns(r))
		typ := w.use("Relation") + "<" + w.classes[r.To] + ">"
		if r.Optional {
			typ += " | null"
		}
		fmt.Fprintf(w.b, "  %s!: %s;\n", r.FromIdent, typ)
	}
	for _, r := range t.In {
		if len(r.From.PK) == 0 {
			continue
		}
		w.b.WriteString("\n")
		if r.OneToOne {
			fmt.Fprintf(w.b, "  @%s(() => %s, (t) => t.%s)\n", w.use("OneToOne"), w.classes[r.From], r.FromIdent)
			fmt.Fprintf(w.b, "  %s!: %s<%s> | null;\n", r.ToIdent, w.use("Relation"), w.classes[r.From])
			continue
		}
		fmt.Fprintf(w.b, "  @%s(() => %s, (t) => t.%s)\n", w.use("OneToMany"), w.classes[r.From], r.FromIdent)
		fmt.Fprintf(w.b, "  %s!: %s[];\n", r.ToIdent, w.classes[r.From])
	}
	w.b.WriteString("}\n")
}

func (w *typeormTable) joinColumns(r *Relation) string {
	named := r.ConstraintName != "" && !w.m.Dialect.SQL().InlineForeignKeys
	cols := make([]string, len(r.FromFields))
	for i, f := range r.FromFields {
		c := "{ name: " + db.JSString(f.Name) + ", referencedColumnName: " + db.JSString(r.ToFields[i].Ident)
		if named {
			c += ", foreignKeyConstraintName: " + db.JSString(r.ConstraintName)
		}
		cols[i] = c + " }"
	}
	if len(cols) == 1 {
		return cols[0]
	}
	return "[" + strings.Join(cols, ", ") + "]"
}

func (w *typeormTable) field(f *Field) {
	t := w.t
	pk := slices.Contains(t.PK, f)
	opts := []string{}
	if f.Name != f.Ident {
		opts = append(opts, "name: "+db.JSString(f.Name))
	}
	col := w.m.Dialect.TypeORM(f.Field)
	opts = append(opts, typeormType(f, col.Type)...)
	ts := col.TS
	if f.Enum != nil {
		ts = w.enums[f.Enum]
		vals := make([]string, len(f.Enum.Values))
		for i, v := range f.Enum.Values {
			vals[i] = db.JSString(v.Name)
		}
		opts = append(opts, "enum: ["+strings.Join(vals, ", ")+"]")
		if base, _ := db.TypeArgs(f.NativeType); base == strings.ToLower(f.Enum.Name) {
			opts = append(opts, "enumName: "+db.JSString(f.Enum.Name))
		}
	}
	if ts == "" {
		ts = "unknown"
	}
	if f.Nullable && !pk {
		opts = append(opts, "nullable: true")
	}
	for _, u := range t.DeclaredUnique {
		if len(u) == 1 && u[0] == f {
			opts = append(opts, "unique: true")
		}
	}
	if d := typeormDefault(w.m, f, ts, col.Default); d != "" {
		opts = append(opts, "default: "+d)
	}

	auto := f.AutoGenerated || f.Identity != ""
	strategy := "'increment'"
	if f.Identity != "" {
		strategy = "'identity'"
		opts = append(opts, "generatedIdentity: "+db.JSString(string(f.Identity)))
	}
	switch {
	case pk && auto && len(t.PK) == 1:
		fmt.Fprintf(w.b, "  @%s(%s, { %s })\n", w.use("PrimaryGeneratedColumn"), strategy, strings.Join(opts, ", "))
	case pk:
		fmt.Fprintf(w.b, "  @%s({ %s })\n", w.use("PrimaryColumn"), strings.Join(opts, ", "))
	default:
		if auto {
			fmt.Fprintf(w.b, "  @%s(%s)\n", w.use("Generated"), strategy)
			opts = slices.DeleteFunc(opts, func(o string) bool { return strings.HasPrefix(o, "generatedIdentity:") })
		}
		fmt.Fprintf(w.b, "  @%s({ %s })\n", w.use("Column"), strings.Join(opts, ", "))
	}
	if f.Nullable && !pk && ts != "unknown" {
		ts += " | null"
	}
	fmt.Fprintf(w.b, "  %s!: %s;\n", f.Ident, ts)
}

// typeormType splits a native type into TypeORM's type, its arguments and
// modifiers: varchar(40) is type and length, int unsigned type and unsigned.
func typeormType(f *Field, override string) []string {
	if f.Enum != nil {
		return []string{"type: 'enum'"}
	}
	base, args := db.TypeArgs(f.NativeType)
	var opts []string
	words := strings.Fields(base)
	words = slices.DeleteFunc(words, func(w string) bool {
		switch w {
		case "unsigned":
			opts = append(opts, "unsigned: true")
		case "zerofill": // TypeORM 1 has no display widths or zerofill
		default:
			return false
		}
		return true
	})
	base = strings.Join(words, " ")
	array := strings.HasSuffix(base, "[]")
	base = strings.TrimSuffix(base, "[]")
	if override != "" {
		base = override
	}
	out := []string{"type: " + db.JSString(base)}
	switch first := words0(base); {
	case len(args) == 0:
	case slices.Contains([]string{"numeric", "decimal", "dec", "fixed", "float", "double", "real"}, first):
		out = append(out, "precision: "+args[0])
		if len(args) > 1 {
			out = append(out, "scale: "+args[1])
		}
	case slices.Contains([]string{"char", "character", "varchar", "nchar", "nvarchar", "binary", "varbinary", "bit", "varbit", "varying"}, first):
		out = append(out, "length: "+args[0])
	case strings.HasPrefix(first, "time") || first == "datetime" || first == "interval":
		out = append(out, "precision: "+args[0])
	}
	if array {
		out = append(out, "array: true")
	}
	return append(out, opts...)
}

func words0(s string) string {
	if i := strings.IndexByte(s, ' '); i >= 0 {
		return s[:i]
	}
	return s
}

// typeormDefault writes a default TypeORM can quote itself as a JS value, and
// any other as raw SQL: TypeORM wraps strings in quotes without escaping them.
func typeormDefault(m *Model, f *Field, ts, raw string) string {
	if f.AutoGenerated || f.DefaultValue == nil {
		return ""
	}
	d := m.Dialect.Default(f.Field)
	num := d.Kind == db.DefaultNumber || d.Kind == db.DefaultString && db.ParseDefault(d.Value).Kind == db.DefaultNumber
	switch {
	case d.Kind == db.DefaultNone:
		return ""
	case ts == "boolean" && (d.Value == "true" || d.Value == "1"):
		return "true"
	case ts == "boolean" && (d.Value == "false" || d.Value == "0"):
		return "false"
	case ts == "number" && num && jsNumber(d.Value):
		return d.Value
	case strings.Contains(d.Value, "'"):
	case d.Kind == db.DefaultString || ts == "string" && num:
		return db.JSString(d.Value)
	}
	if raw == "" {
		raw = *f.DefaultValue
	}
	return "() => " + db.JSString(raw)
}

// jsNumber reports whether s reads back from a JS number unchanged (1.50 does not).
func jsNumber(s string) bool {
	v, err := strconv.ParseFloat(s, 64)
	return err == nil && strconv.FormatFloat(v, 'f', -1, 64) == strings.TrimPrefix(s, "+")
}

func typeormProps(fs []*Field) string {
	names := make([]string, len(fs))
	for i, f := range fs {
		names[i] = db.JSString(f.Ident)
	}
	return strings.Join(names, ", ")
}
