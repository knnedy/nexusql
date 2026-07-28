package sqlite

import (
	"fmt"
	"sort"
	"strings"

	"github.com/knnedy/nexusql/internal/db"
)

func needsSqlHelper(d string) bool {
	return strings.Contains(d, "(")
}

// formatDefault cleans a SQLite column_default expression for embedding in
// generated code. SQLite (via PRAGMA table_info) often wraps expression
// defaults in an extra layer of parens (e.g. "(CURRENT_TIMESTAMP)" or
// "(datetime('now'))"); literal defaults come through unwrapped (e.g. "0",
// "'active'"). Only expression-shaped defaults get the sql“ wrapper.
func formatDefault(d string) string {
	trimmed := strings.TrimSpace(d)
	if strings.HasPrefix(trimmed, "(") && strings.HasSuffix(trimmed, ")") {
		trimmed = strings.TrimSuffix(strings.TrimPrefix(trimmed, "("), ")")
	}
	if needsSqlHelper(trimmed) || strings.EqualFold(trimmed, "CURRENT_TIMESTAMP") ||
		strings.EqualFold(trimmed, "CURRENT_DATE") || strings.EqualFold(trimmed, "CURRENT_TIME") {
		return fmt.Sprintf("sql`%s`", trimmed)
	}
	return trimmed
}

func GeneratePrisma(schema *db.Schema) string {
	var sb strings.Builder

	sb.WriteString("datasource db {\n  provider = \"sqlite\"\n  url      = env(\"DATABASE_URL\")\n}\n\n")
	sb.WriteString("generator client {\n  provider = \"prisma-client-js\"\n}\n\n")

	relLookup := db.BuildRelationLookup(schema.Relations)

	// Note: SQLite has no native enum type, so schema.Enums is always empty
	// for this provider (see IntrospectSchema) — no enum block is emitted.

	for _, t := range schema.Tables {
		if !db.IsUserTable(t.Name) {
			continue
		}

		sb.WriteString(fmt.Sprintf("model %s {\n", db.Capitalize(t.Name)))

		for _, f := range t.Fields {
			prismaType := mapPrismaType(f.Type)
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

	importsSet := map[string]bool{"sqliteTable": true}
	for _, t := range schema.Tables {
		if !db.IsUserTable(t.Name) {
			continue
		}
		for _, f := range t.Fields {
			for _, imp := range drizzleImports(f.Type, f.IsPrimaryKey) {
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

	sb.WriteString(fmt.Sprintf("import { %s } from 'drizzle-orm/sqlite-core';\n\n", strings.Join(importList, ", ")))

	for _, t := range schema.Tables {
		if !db.IsUserTable(t.Name) {
			continue
		}

		sb.WriteString(fmt.Sprintf("export const %s = sqliteTable('%s', {\n", t.Name, t.Name))

		for _, f := range t.Fields {
			col := mapDrizzleType(f.Name, f.Type, f.IsPrimaryKey)

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

// mapPrismaType has no enumSet parameter, unlike the Postgres version —
// SQLite never produces enum-name FieldTypes (see IntrospectSchema), so
// that branch would be dead code here.
func mapPrismaType(t db.FieldType) string {
	switch t {
	case db.FieldTypeSmallint, db.FieldTypeInteger, db.FieldTypeSerial:
		return "Int"
	case db.FieldTypeBigint, db.FieldTypeBigserial:
		return "BigInt"
	case db.FieldTypeVarchar, db.FieldTypeText, db.FieldTypeChar, db.FieldTypeUUID:
		return "String"
	case db.FieldTypeBoolean:
		return "Boolean"
	case db.FieldTypeTimestamp, db.FieldTypeTimestamptz, db.FieldTypeDate, db.FieldTypeTime:
		return "DateTime"
	case db.FieldTypeNumeric, db.FieldTypeReal, db.FieldTypeDoublePrecision:
		// Prisma's Decimal type is unsupported on the sqlite connector.
		return "Float"
	case db.FieldTypeBytea:
		return "Bytes"
	default:
		// Covers JSON/JSONB/Interval — also unsupported scalar types on
		// the sqlite connector — and anything genuinely unrecognized.
		return "String // " + string(t)
	}
}

func mapDrizzleType(name string, t db.FieldType, isPk bool) string {
	if isPk {
		if t == db.FieldTypeUUID {
			// sqlite-core has no built-in random-UUID default the way
			// pg-core's .defaultRandom() does; add a generator manually:
			// .$defaultFn(() => crypto.randomUUID())
			return fmt.Sprintf("text('%s').primaryKey()", name)
		}
		return fmt.Sprintf("integer('%s', { mode: 'number' }).primaryKey({ autoIncrement: true })", name)
	}
	switch t {
	case db.FieldTypeVarchar, db.FieldTypeChar, db.FieldTypeText, db.FieldTypeUUID:
		return fmt.Sprintf("text('%s')", name)
	case db.FieldTypeInteger, db.FieldTypeSmallint, db.FieldTypeBigint, db.FieldTypeBigserial:
		return fmt.Sprintf("integer('%s', { mode: 'number' })", name)
	case db.FieldTypeBoolean:
		return fmt.Sprintf("integer('%s', { mode: 'boolean' })", name)
	case db.FieldTypeTimestamp, db.FieldTypeTimestamptz, db.FieldTypeDate, db.FieldTypeTime:
		return fmt.Sprintf("integer('%s', { mode: 'timestamp' })", name)
	case db.FieldTypeJSON, db.FieldTypeJSONB:
		return fmt.Sprintf("text('%s', { mode: 'json' })", name)
	case db.FieldTypeNumeric, db.FieldTypeReal, db.FieldTypeDoublePrecision:
		return fmt.Sprintf("real('%s')", name)
	case db.FieldTypeBytea:
		return fmt.Sprintf("blob('%s')", name)
	default:
		return fmt.Sprintf("text('%s') /* %s */", name, string(t))
	}
}

func drizzleImports(t db.FieldType, isPk bool) []string {
	if isPk {
		if t == db.FieldTypeUUID {
			return []string{"text"}
		}
		return []string{"integer"}
	}
	switch t {
	case db.FieldTypeVarchar, db.FieldTypeChar, db.FieldTypeText, db.FieldTypeUUID:
		return []string{"text"}
	case db.FieldTypeInteger, db.FieldTypeSmallint, db.FieldTypeBigint, db.FieldTypeBigserial:
		return []string{"integer"}
	case db.FieldTypeBoolean:
		return []string{"integer"}
	case db.FieldTypeTimestamp, db.FieldTypeTimestamptz, db.FieldTypeDate, db.FieldTypeTime:
		return []string{"integer"}
	case db.FieldTypeJSON, db.FieldTypeJSONB:
		return []string{"text"}
	case db.FieldTypeNumeric, db.FieldTypeReal, db.FieldTypeDoublePrecision:
		return []string{"real"}
	case db.FieldTypeBytea:
		return []string{"blob"}
	default:
		return []string{"text"}
	}
}
