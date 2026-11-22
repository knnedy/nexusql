package export

import (
	"fmt"
	"slices"
	"strings"

	"github.com/knnedy/nexusql/internal/db"
)

// jsReserved are words a const cannot be named.
var jsReserved = map[string]bool{
	"break": true, "case": true, "catch": true, "class": true, "const": true, "continue": true,
	"debugger": true, "default": true, "delete": true, "do": true, "else": true, "enum": true,
	"export": true, "extends": true, "false": true, "finally": true, "for": true, "function": true,
	"if": true, "import": true, "in": true, "instanceof": true, "new": true, "null": true,
	"return": true, "super": true, "switch": true, "this": true, "throw": true, "true": true,
	"try": true, "typeof": true, "var": true, "void": true, "while": true, "with": true,
	"let": true, "static": true, "yield": true, "await": true, "implements": true,
	"interface": true, "package": true, "private": true, "protected": true, "public": true,
}

type drizzle struct {
	m       *Model
	d       db.DrizzleDialect
	imports map[string]bool
	useSQL  bool
	consts  map[string]bool
	tables  map[*Table]string
	enums   map[*Enum]string
	custom  map[string]string // declared type -> customType const
	order   []string          // custom declarations, in first-use order
}

// Drizzle renders m as drizzle-orm table definitions.
func Drizzle(m *Model) string {
	z := &drizzle{
		m: m, d: m.Dialect.Drizzle(), imports: map[string]bool{}, consts: map[string]bool{},
		tables: map[*Table]string{}, enums: map[*Enum]string{}, custom: map[string]string{},
	}
	z.imports[z.d.Table] = true

	// Column calls come first: they decide the imports, which consts must not shadow.
	calls := map[*Field]string{}
	for _, t := range m.Tables {
		for _, f := range t.Fields {
			calls[f] = z.column(f)
		}
	}
	for name := range z.imports {
		z.consts[name] = true
	}
	for _, name := range []string{"sql", "primaryKey", "foreignKey", "unique", "customType", z.d.AnyColumn} {
		z.consts[name] = true // imported later, while tables render
	}
	for _, e := range m.Enums {
		if z.d.NamedEnums {
			z.imports[z.d.Enum] = true
			z.enums[e] = unique(e.Ident+"Enum", z.consts)
		}
	}
	for _, t := range m.Tables {
		name := t.Ident
		if jsReserved[name] || z.consts[name] {
			name += "Table"
		}
		z.tables[t] = unique(name, z.consts)
	}
	for _, native := range z.order {
		z.custom[native] = unique(ident(strings.Fields(native)[0])+"Type", z.consts)
	}

	var body strings.Builder
	for _, e := range m.Enums {
		if !z.d.NamedEnums {
			continue
		}
		fmt.Fprintf(&body, "\nexport const %s = %s(%s, [%s]);\n", z.enums[e], z.d.Enum, db.JSString(e.Name), enumValues(e))
	}
	for _, t := range m.Tables {
		z.table(&body, t, calls)
	}

	var head strings.Builder
	if z.useSQL {
		head.WriteString("import { sql } from 'drizzle-orm';\n")
	}
	names := make([]string, 0, len(z.imports))
	for name := range z.imports {
		if name == z.d.AnyColumn {
			name = "type " + name
		}
		names = append(names, name)
	}
	slices.SortFunc(names, func(a, b string) int {
		return strings.Compare(strings.TrimPrefix(a, "type "), strings.TrimPrefix(b, "type "))
	})
	fmt.Fprintf(&head, "import { %s } from '%s';\n", strings.Join(names, ", "), z.d.Module)
	for _, native := range z.order {
		fmt.Fprintf(&head, "\n// %s has no drizzle-orm builder.\nconst %s = customType<{ data: string }>({ dataType: () => %s });\n",
			native, z.custom[native], db.JSString(native))
	}
	return head.String() + body.String()
}

// column returns f's builder call, with "%CUSTOM%" standing for a customType
// const and "%ENUM%" for a shared enum const until they are named.
func (z *drizzle) column(f *Field) string {
	name := db.JSString(f.Name)
	if f.Enum != nil {
		if z.d.NamedEnums {
			return "%ENUM%(" + name + ")"
		}
		z.imports[z.d.Enum] = true
		return fmt.Sprintf("%s(%s, [%s])", z.d.Enum, name, enumValues(f.Enum))
	}
	call, imports := z.m.Dialect.DrizzleColumn(f.Field, name)
	if call == "" {
		native := strings.TrimSpace(f.NativeType)
		if !slices.Contains(z.order, native) {
			z.order = append(z.order, native)
		}
		z.imports["customType"] = true
		return "%CUSTOM%" + native + "%(" + name + ")"
	}
	for _, i := range imports {
		z.imports[i] = true
	}
	return call
}

func (z *drizzle) table(b *strings.Builder, t *Table, calls map[*Field]string) {
	single := map[*Field]*Relation{}
	var extra []string
	for _, r := range t.Out {
		if len(r.FromFields) == 1 {
			if _, taken := single[r.FromFields[0]]; !taken {
				single[r.FromFields[0]] = r
				continue
			}
		}
		z.imports["foreignKey"] = true
		fk := fmt.Sprintf("foreignKey({ columns: [%s], foreignColumns: [%s] })",
			z.refs("t", r.FromFields), z.refs(z.target(t, r.To), r.ToFields))
		for _, a := range drizzleActions(r) {
			fk += fmt.Sprintf(".%s('%s')", a[0], a[1])
		}
		extra = append(extra, fk)
	}
	if len(t.PK) > 1 {
		z.imports["primaryKey"] = true
		extra = append([]string{fmt.Sprintf("primaryKey({ columns: [%s] })", z.refs("t", t.PK))}, extra...)
	}
	for _, u := range t.Unique {
		if len(u) > 1 {
			z.imports["unique"] = true
			extra = append(extra, fmt.Sprintf("unique().on(%s)", z.refs("t", u)))
		}
	}

	fmt.Fprintf(b, "\nexport const %s = %s(%s, {\n", z.tables[t], z.d.Table, db.JSString(t.Name))
	for _, f := range t.Fields {
		col := z.resolve(calls[f], f)
		if len(t.PK) == 1 && t.PK[0] == f && f.Monotonic && z.d.AutoIncrementPK {
			col += ".primaryKey({ autoIncrement: true })"
		} else if len(t.PK) == 1 && t.PK[0] == f {
			col += ".primaryKey()"
		} else if !f.Nullable {
			col += ".notNull()"
		}
		for _, u := range t.Unique {
			if len(u) == 1 && u[0] == f {
				col += ".unique()"
			}
		}
		col += z.defaultValue(f)
		if r := single[f]; r != nil {
			z.imports[z.d.AnyColumn] = true
			ref := fmt.Sprintf("(): %s => %s.%s", z.d.AnyColumn, z.tables[r.To], r.ToFields[0].Ident)
			var opts []string
			for _, a := range drizzleActions(r) {
				opts = append(opts, fmt.Sprintf("%s: '%s'", a[0], a[1]))
			}
			if len(opts) > 0 {
				ref += ", { " + strings.Join(opts, ", ") + " }"
			}
			col += ".references(" + ref + ")"
		}
		fmt.Fprintf(b, "  %s: %s,\n", f.Ident, col)
	}
	if len(extra) == 0 {
		b.WriteString("});\n")
		return
	}
	b.WriteString("}, (t) => [\n")
	for _, e := range extra {
		fmt.Fprintf(b, "  %s,\n", e)
	}
	b.WriteString("]);\n")
}

func (z *drizzle) resolve(call string, f *Field) string {
	if f.Enum != nil && z.d.NamedEnums {
		return strings.Replace(call, "%ENUM%", z.enums[f.Enum], 1)
	}
	if rest, ok := strings.CutPrefix(call, "%CUSTOM%"); ok {
		native, args, _ := strings.Cut(rest, "%")
		return z.custom[native] + args
	}
	return call
}

// target names the referenced table inside t's extra config, where t itself is the parameter.
func (z *drizzle) target(t, to *Table) string {
	if t == to {
		return "t"
	}
	return z.tables[to]
}

func (z *drizzle) refs(table string, fs []*Field) string {
	out := make([]string, len(fs))
	for i, f := range fs {
		out[i] = table + "." + f.Ident
	}
	return strings.Join(out, ", ")
}

// defaultValue renders f's default as a JS value where drizzle takes one,
// and as raw SQL otherwise.
func (z *drizzle) defaultValue(f *Field) string {
	if f.AutoGenerated || f.DefaultValue == nil {
		return ""
	}
	d := z.m.Dialect.Default(f.Field)
	if d.Kind == db.DefaultNone {
		return ""
	}
	numeric := d.Kind == db.DefaultNumber || d.Kind == db.DefaultString && db.ParseDefault(d.Value).Kind == db.DefaultNumber
	switch f.Type {
	case db.FieldTypeBoolean:
		switch d.Value {
		case "true", "1", "t":
			return ".default(true)"
		case "false", "0", "f":
			return ".default(false)"
		}
	case db.FieldTypeSmallint, db.FieldTypeInteger, db.FieldTypeSerial, db.FieldTypeReal, db.FieldTypeDoublePrecision:
		if numeric {
			return ".default(" + d.Value + ")"
		}
	case db.FieldTypeBigint, db.FieldTypeBigserial:
		if numeric && isInteger(d.Value) {
			if z.d.BigInt {
				return ".default(" + d.Value + "n)"
			}
			return ".default(" + d.Value + ")"
		}
	case db.FieldTypeNumeric:
		if numeric {
			return ".default(" + db.JSString(d.Value) + ")"
		}
	case db.FieldTypeText, db.FieldTypeVarchar, db.FieldTypeChar, db.FieldTypeUUID:
		if d.Kind == db.DefaultString {
			return ".default(" + db.JSString(d.Value) + ")"
		}
	case db.FieldTypeTimestamp, db.FieldTypeTimestamptz:
		if d.Kind == db.DefaultNow && z.d.DefaultNow {
			return ".defaultNow()"
		}
	}
	if f.Enum != nil && d.Kind == db.DefaultString {
		return ".default(" + db.JSString(d.Value) + ")"
	}
	z.useSQL = true
	return ".default(sql`" + strings.NewReplacer("\\", "\\\\", "`", "\\`", "${", "\\${").Replace(*f.DefaultValue) + "`)"
}

// drizzleActions are r's actions other than drizzle's default, no action.
func drizzleActions(r *Relation) [][2]string {
	var out [][2]string
	for _, a := range []struct {
		name string
		got  db.RefAction
	}{{"onDelete", r.OnDelete}, {"onUpdate", r.OnUpdate}} {
		if a.got != "" && a.got != db.NoAction {
			out = append(out, [2]string{a.name, strings.ToLower(string(a.got))})
		}
	}
	return out
}

func enumValues(e *Enum) string {
	vals := make([]string, len(e.Values))
	for i, v := range e.Values {
		vals[i] = db.JSString(v.Name)
	}
	return strings.Join(vals, ", ")
}
