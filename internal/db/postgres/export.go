package postgres

import (
	"fmt"
	"sort"
	"strings"

	"github.com/knnedy/nexusql/internal/db"
)

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

func GeneratePrisma(schema *db.Schema) string {
	var sb strings.Builder
	relLookup := db.BuildRelationLookup(schema.Relations)
	enumSet := db.BuildEnumSet(schema.Enums)

	sb.WriteString("datasource db {\n  provider = \"postgresql\"\n  url      = env(\"DATABASE_URL\")\n}\n\n")
	sb.WriteString("generator client {\n  provider = \"prisma-client-js\"\n}\n\n")

	for _, e := range schema.Enums {
		sb.WriteString(fmt.Sprintf("enum %s {\n", db.Capitalize(e.Name)))
		for _, v := range e.Values {
			sb.WriteString(fmt.Sprintf("  %s\n", strings.ToUpper(v)))
		}
		sb.WriteString("}\n\n")
	}

	for _, t := range schema.Tables {
		if !db.IsUserTable(t.Name) {
			continue
		}

		sb.WriteString(fmt.Sprintf("model %s {\n", db.Capitalize(t.Name)))

		for _, f := range t.Fields {
			prismaType := mapPrismaType(f.Type, enumSet)
			optional := ""
			if f.Nullable && !f.IsPrimaryKey {
				optional = "?"
			}

			line := fmt.Sprintf("  %-20s %s%s", f.Name, prismaType, optional)

			if f.IsPrimaryKey {
				if f.Type == db.FieldTypeUUID {
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
			refModel := db.Capitalize(rel.TargetTable)
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

func GenerateDrizzle(schema *db.Schema) string {
	var sb strings.Builder
	relLookup := db.BuildRelationLookup(schema.Relations)
	enumSet := db.BuildEnumSet(schema.Enums)

	importsSet := map[string]bool{"pgTable": true}
	if len(schema.Enums) > 0 {
		importsSet["pgEnum"] = true
	}
	for _, t := range schema.Tables {
		if !db.IsUserTable(t.Name) {
			continue
		}
		for _, f := range t.Fields {
			for _, imp := range drizzleImports(f.Type, f.IsPrimaryKey, enumSet) {
				importsSet[imp] = true
			}
		}
	}
	for _, t := range schema.Tables {
		if !db.IsUserTable(t.Name) {
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
		if !db.IsUserTable(t.Name) {
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

func mapPrismaType(t db.FieldType, enumSet map[string]bool) string {
	switch t {
	case db.FieldTypeSmallint, db.FieldTypeInteger, db.FieldTypeSerial:
		return "Int"
	case db.FieldTypeBigint, db.FieldTypeBigserial:
		return "BigInt"
	case db.FieldTypeVarchar, db.FieldTypeText, db.FieldTypeChar:
		return "String"
	case db.FieldTypeUUID:
		return "String @db.Uuid"
	case db.FieldTypeBoolean:
		return "Boolean"
	case db.FieldTypeTimestamp, db.FieldTypeTimestamptz:
		return "DateTime"
	case db.FieldTypeJSON, db.FieldTypeJSONB:
		return "Json"
	case db.FieldTypeNumeric, db.FieldTypeReal, db.FieldTypeDoublePrecision:
		return "Float"
	default:
		if enumSet[string(t)] {
			return db.Capitalize(string(t))
		}
		return "String // " + string(t)
	}
}

func mapDrizzleType(name string, t db.FieldType, isPk bool, enumSet map[string]bool) string {
	if isPk {
		if t == db.FieldTypeUUID {
			return fmt.Sprintf("uuid('%s').primaryKey().defaultRandom()", name)
		}
		return fmt.Sprintf("serial('%s').primaryKey()", name)
	}
	switch t {
	case db.FieldTypeVarchar, db.FieldTypeChar:
		return fmt.Sprintf("varchar('%s', { length: 255 })", name)
	case db.FieldTypeText:
		return fmt.Sprintf("text('%s')", name)
	case db.FieldTypeInteger:
		return fmt.Sprintf("integer('%s')", name)
	case db.FieldTypeSmallint:
		return fmt.Sprintf("smallint('%s')", name)
	case db.FieldTypeBigint, db.FieldTypeBigserial:
		return fmt.Sprintf("bigint('%s', { mode: 'number' })", name)
	case db.FieldTypeBoolean:
		return fmt.Sprintf("boolean('%s')", name)
	case db.FieldTypeTimestamp:
		return fmt.Sprintf("timestamp('%s')", name)
	case db.FieldTypeTimestamptz:
		return fmt.Sprintf("timestamp('%s', { withTimezone: true })", name)
	case db.FieldTypeUUID:
		return fmt.Sprintf("uuid('%s')", name)
	case db.FieldTypeJSON:
		return fmt.Sprintf("json('%s')", name)
	case db.FieldTypeJSONB:
		return fmt.Sprintf("jsonb('%s')", name)
	case db.FieldTypeNumeric:
		return fmt.Sprintf("numeric('%s')", name)
	case db.FieldTypeReal:
		return fmt.Sprintf("real('%s')", name)
	case db.FieldTypeDoublePrecision:
		return fmt.Sprintf("doublePrecision('%s')", name)
	default:
		if enumSet[string(t)] {
			return fmt.Sprintf("%sEnum('%s')", string(t), name)
		}
		return fmt.Sprintf("text('%s') /* %s */", name, string(t))
	}
}

func drizzleImports(t db.FieldType, isPk bool, enumSet map[string]bool) []string {
	if isPk {
		if t == db.FieldTypeUUID {
			return []string{"uuid"}
		}
		return []string{"serial"}
	}
	switch t {
	case db.FieldTypeVarchar, db.FieldTypeChar:
		return []string{"varchar"}
	case db.FieldTypeText:
		return []string{"text"}
	case db.FieldTypeInteger:
		return []string{"integer"}
	case db.FieldTypeSmallint:
		return []string{"smallint"}
	case db.FieldTypeBigint, db.FieldTypeBigserial:
		return []string{"bigint"}
	case db.FieldTypeBoolean:
		return []string{"boolean"}
	case db.FieldTypeTimestamp, db.FieldTypeTimestamptz:
		return []string{"timestamp"}
	case db.FieldTypeUUID:
		return []string{"uuid"}
	case db.FieldTypeJSON:
		return []string{"json"}
	case db.FieldTypeJSONB:
		return []string{"jsonb"}
	case db.FieldTypeNumeric:
		return []string{"numeric"}
	case db.FieldTypeReal:
		return []string{"real"}
	case db.FieldTypeDoublePrecision:
		return []string{"doublePrecision"}
	default:
		if enumSet[string(t)] {
			return []string{}
		}
		return []string{"text"}
	}
}
