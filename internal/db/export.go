package db

import (
	"fmt"
	"sort"
	"strings"
)

var migrationTables = map[string]bool{
	"goose_db_version":      true,
	"schema_migrations":     true,
	"flyway_schema_history": true,
	"_prisma_migrations":    true,
	"_sqlx_migrations":      true,
}

func isUserTable(name string) bool {
	return !migrationTables[name]
}

func buildRelationLookup(relations []Relation) map[string]Relation {
	m := make(map[string]Relation, len(relations))
	for _, r := range relations {
		m[r.SourceTable+"."+r.SourceField] = r
	}
	return m
}

func buildEnumSet(enums []EnumType) map[string]bool {
	m := make(map[string]bool, len(enums))
	for _, e := range enums {
		m[e.Name] = true
	}
	return m
}

func capitalize(s string) string {
	if s == "" {
		return ""
	}
	return strings.ToUpper(s[:1]) + s[1:]
}

func needsSqlHelper(d string) bool {
	return strings.Contains(d, "()")
}

func formatDefault(d string) string {
	if idx := strings.Index(d, "::"); idx != -1 {
		d = d[:idx]
	}
	if strings.Contains(d, "()") {
		return fmt.Sprintf("sql`%s`", d)
	}
	return d
}

func GeneratePrisma(schema *Schema) string {
	var sb strings.Builder
	relLookup := buildRelationLookup(schema.Relations)
	enumSet := buildEnumSet(schema.Enums)

	sb.WriteString("datasource db {\n  provider = \"postgresql\"\n  url      = env(\"DATABASE_URL\")\n}\n\n")
	sb.WriteString("generator client {\n  provider = \"prisma-client-js\"\n}\n\n")

	for _, e := range schema.Enums {
		sb.WriteString(fmt.Sprintf("enum %s {\n", capitalize(e.Name)))
		for _, v := range e.Values {
			sb.WriteString(fmt.Sprintf("  %s\n", strings.ToUpper(v)))
		}
		sb.WriteString("}\n\n")
	}

	for _, t := range schema.Tables {
		if !isUserTable(t.Name) {
			continue
		}

		sb.WriteString(fmt.Sprintf("model %s {\n", capitalize(t.Name)))

		for _, f := range t.Fields {
			prismaType := mapPrismaType(f.Type, enumSet)
			optional := ""
			if f.Nullable && !f.IsPrimaryKey {
				optional = "?"
			}

			line := fmt.Sprintf("  %-20s %s%s", f.Name, prismaType, optional)

			if f.IsPrimaryKey {
				if f.Type == "uuid" {
					line += "  @id @default(uuid())"
				} else {
					line += "  @id @default(autoincrement())"
				}
			}

			sb.WriteString(line)
			sb.WriteString("\n")
		}

		addedRelations := map[string]bool{}
		for _, f := range t.Fields {
			if !f.IsForeignKey {
				continue
			}
			rel, ok := relLookup[t.Name+"."+f.Name]
			if !ok || addedRelations[rel.TargetTable] {
				continue
			}
			addedRelations[rel.TargetTable] = true
			refModel := capitalize(rel.TargetTable)
			nullable := ""
			if f.Nullable {
				nullable = "?"
			}
			sb.WriteString(fmt.Sprintf("  %-20s %s%s @relation(fields: [%s], references: [%s])\n",
				rel.TargetTable, refModel, nullable, f.Name, rel.TargetField))
		}

		sb.WriteString("}\n\n")
	}

	return strings.TrimSpace(sb.String())
}

func GenerateDrizzle(schema *Schema) string {
	var sb strings.Builder
	relLookup := buildRelationLookup(schema.Relations)
	enumSet := buildEnumSet(schema.Enums)

	importsSet := map[string]bool{"pgTable": true}
	if len(schema.Enums) > 0 {
		importsSet["pgEnum"] = true
	}
	for _, t := range schema.Tables {
		if !isUserTable(t.Name) {
			continue
		}
		for _, f := range t.Fields {
			for _, imp := range drizzleImports(f.Type, f.IsPrimaryKey, enumSet) {
				importsSet[imp] = true
			}
		}
	}
	for _, t := range schema.Tables {
		if !isUserTable(t.Name) {
			continue
		}
		for _, f := range t.Fields {
			if f.DefaultValue != nil && needsSqlHelper(*f.DefaultValue) {
				importsSet["sql"] = true
			}
		}
	}

	importList := make([]string, 0, len(importsSet))
	for k := range importsSet {
		importList = append(importList, k)
	}
	sort.Strings(importList)

	sb.WriteString(fmt.Sprintf("import { %s } from 'drizzle-orm/pg-core';\n\n", strings.Join(importList, ", ")))

	for _, e := range schema.Enums {
		values := make([]string, len(e.Values))
		for i, v := range e.Values {
			values[i] = fmt.Sprintf("'%s'", v)
		}
		sb.WriteString(fmt.Sprintf("export const %sEnum = pgEnum('%s', [%s]);\n\n",
			e.Name, e.Name, strings.Join(values, ", ")))
	}

	for _, t := range schema.Tables {
		if !isUserTable(t.Name) {
			continue
		}

		sb.WriteString(fmt.Sprintf("export const %s = pgTable('%s', {\n", t.Name, t.Name))

		for _, f := range t.Fields {
			col := mapDrizzleType(f.Name, f.Type, f.IsPrimaryKey, enumSet)

			if f.IsForeignKey {
				if rel, ok := relLookup[t.Name+"."+f.Name]; ok {
					col += fmt.Sprintf(".references(() => %s.%s)", rel.TargetTable, rel.TargetField)
				}
			}

			if !f.Nullable && !f.IsPrimaryKey {
				col += ".notNull()"
			}

			if f.DefaultValue != nil {
				col += fmt.Sprintf(".default(%s)", formatDefault(*f.DefaultValue))
			}

			sb.WriteString(fmt.Sprintf("  %s: %s,\n", f.Name, col))
		}

		sb.WriteString("});\n\n")
	}

	return strings.TrimSpace(sb.String())
}

func mapPrismaType(t string, enumSet map[string]bool) string {
	switch t {
	case "int2", "int4", "integer", "smallint", "serial":
		return "Int"
	case "int8", "bigint", "bigserial":
		return "BigInt"
	case "varchar", "text", "char", "bpchar":
		return "String"
	case "uuid":
		return "String @db.Uuid"
	case "bool", "boolean":
		return "Boolean"
	case "timestamp", "timestamptz", "timestamp with time zone":
		return "DateTime"
	case "json", "jsonb":
		return "Json"
	case "numeric", "real", "float4", "float8", "double precision":
		return "Float"
	default:
		if enumSet[t] {
			return capitalize(t)
		}
		return "String // " + t
	}
}

func mapDrizzleType(name, t string, isPk bool, enumSet map[string]bool) string {
	if isPk {
		if t == "uuid" {
			return fmt.Sprintf("uuid('%s').primaryKey().defaultRandom()", name)
		}
		return fmt.Sprintf("serial('%s').primaryKey()", name)
	}
	switch t {
	case "varchar", "char", "bpchar":
		return fmt.Sprintf("varchar('%s', { length: 255 })", name)
	case "text":
		return fmt.Sprintf("text('%s')", name)
	case "int4", "integer":
		return fmt.Sprintf("integer('%s')", name)
	case "int2", "smallint":
		return fmt.Sprintf("smallint('%s')", name)
	case "int8", "bigint", "bigserial":
		return fmt.Sprintf("bigint('%s', { mode: 'number' })", name)
	case "bool", "boolean":
		return fmt.Sprintf("boolean('%s')", name)
	case "timestamp":
		return fmt.Sprintf("timestamp('%s')", name)
	case "timestamptz", "timestamp with time zone":
		return fmt.Sprintf("timestamp('%s', { withTimezone: true })", name)
	case "uuid":
		return fmt.Sprintf("uuid('%s')", name)
	case "json":
		return fmt.Sprintf("json('%s')", name)
	case "jsonb":
		return fmt.Sprintf("jsonb('%s')", name)
	case "numeric":
		return fmt.Sprintf("numeric('%s')", name)
	case "real", "float4":
		return fmt.Sprintf("real('%s')", name)
	case "float8", "double precision":
		return fmt.Sprintf("doublePrecision('%s')", name)
	default:
		if enumSet[t] {
			return fmt.Sprintf("%sEnum('%s')", t, name)
		}
		return fmt.Sprintf("text('%s') /* %s */", name, t)
	}
}

func drizzleImports(t string, isPk bool, enumSet map[string]bool) []string {
	if isPk {
		if t == "uuid" {
			return []string{"uuid"}
		}
		return []string{"serial"}
	}
	switch t {
	case "varchar", "char", "bpchar":
		return []string{"varchar"}
	case "text":
		return []string{"text"}
	case "int4", "integer":
		return []string{"integer"}
	case "int2", "smallint":
		return []string{"smallint"}
	case "int8", "bigint", "bigserial":
		return []string{"bigint"}
	case "bool", "boolean":
		return []string{"boolean"}
	case "timestamp", "timestamptz", "timestamp with time zone":
		return []string{"timestamp"}
	case "uuid":
		return []string{"uuid"}
	case "json":
		return []string{"json"}
	case "jsonb":
		return []string{"jsonb"}
	case "numeric":
		return []string{"numeric"}
	case "real", "float4":
		return []string{"real"}
	case "float8", "double precision":
		return []string{"doublePrecision"}
	default:
		if enumSet[t] {
			return []string{}
		}
		return []string{"text"}
	}
}
