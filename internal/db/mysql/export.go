package mysql

import (
	"fmt"
	"sort"
	"strings"

	"github.com/knnedy/nexusql/internal/db"
)

func needsSqlHelper(d string) bool {
	return strings.Contains(d, "(")
}

// formatDefault cleans a MySQL COLUMN_DEFAULT expression for embedding in
// generated code. Like SQLite (and unlike Postgres, which needs "::type"
// cast-suffix stripping), MySQL 8.0.13+ wraps expression/function defaults
// in an extra layer of parens when reported via information_schema
func formatDefault(d string) string {
	trimmed := strings.TrimSpace(d)
	if strings.HasPrefix(trimmed, "(") && strings.HasSuffix(trimmed, ")") {
		trimmed = strings.TrimSuffix(strings.TrimPrefix(trimmed, "("), ")")
	}
	if needsSqlHelper(trimmed) || strings.EqualFold(trimmed, "CURRENT_TIMESTAMP") {
		return fmt.Sprintf("sql`%s`", trimmed)
	}
	return trimmed
}

func GeneratePrisma(schema *db.Schema) string {
	var sb strings.Builder
	relLookup := db.BuildRelationLookup(schema.Relations)
	enumSet := db.BuildEnumSet(schema.Enums)

	sb.WriteString("datasource db {\n  provider = \"mysql\"\n  url      = env(\"DATABASE_URL\")\n}\n\n")
	sb.WriteString("generator client {\n  provider = \"prisma-client-js\"\n}\n\n")

	// Unlike SQLite, MySQL's Prisma connector has native enum support, so
	// this mirrors the Postgres path exactly — including reusing the
	// synthesized table_column enum names from schema.go as-is, since
	// Prisma enum identifiers accept underscores.
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

	// drizzle-orm/mysql-core has no separate exported-enum concept like
	// pg-core's pgEnum — mysqlEnum takes its value list inline at each
	// call site. So enum lookup here needs the actual EnumType.Values,
	// not just a name membership set.
	enumLookup := make(map[string]db.EnumType, len(schema.Enums))
	for _, e := range schema.Enums {
		enumLookup[e.Name] = e
	}

	importsSet := map[string]bool{"mysqlTable": true}
	for _, t := range schema.Tables {
		if !db.IsUserTable(t.Name) {
			continue
		}
		for _, f := range t.Fields {
			for _, imp := range drizzleImports(f.Type, f.IsPrimaryKey, enumLookup) {
				importsSet[imp] = true
			}
		}
	}
	for _, t := range schema.Tables {
		if !db.IsUserTable(t.Name) {
			continue
		}
		for _, f := range t.Fields {
			if f.DefaultValue != nil && *f.DefaultValue != "AUTO_INCREMENT" && needsSqlHelper(*f.DefaultValue) {
				importsSet["sql"] = true
			}
		}
	}

	importList := make([]string, 0, len(importsSet))
	for k := range importsSet {
		importList = append(importList, k)
	}
	sort.Strings(importList)

	sb.WriteString(fmt.Sprintf("import { %s } from 'drizzle-orm/mysql-core';\n\n", strings.Join(importList, ", ")))

	for _, t := range schema.Tables {
		if !db.IsUserTable(t.Name) {
			continue
		}

		sb.WriteString(fmt.Sprintf("export const %s = mysqlTable('%s', {\n", t.Name, t.Name))

		for _, f := range t.Fields {
			col := mapDrizzleType(f.Name, f.Type, f.IsPrimaryKey, enumLookup)

			if f.IsForeignKey {
				if rel, ok := relLookup[t.Name+"."+f.Name]; ok {
					col += fmt.Sprintf(".references(() => %s.%s)", rel.TargetTable, rel.TargetField)
				}
			}

			if !f.Nullable && !f.IsPrimaryKey {
				col += ".notNull()"
			}

			// "AUTO_INCREMENT" is schema.go's implicit-default sentinel
			// for auto_increment columns, not a real SQL default — the PK
			// branch of mapDrizzleType already emits .autoincrement(), so
			// it's excluded here to avoid a bogus .default(AUTO_INCREMENT)
			// call.
			if f.DefaultValue != nil && *f.DefaultValue != "AUTO_INCREMENT" {
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
		// MySQL has no native UUID type; UUID-typed PKs here mean a
		// char(36)/varchar(36) column, so no @db.Uuid attribute (that's
		// Postgres-specific) — plain String is correct.
		return "String"
	case db.FieldTypeBoolean:
		return "Boolean"
	case db.FieldTypeTimestamp, db.FieldTypeTimestamptz, db.FieldTypeDate, db.FieldTypeTime:
		return "DateTime"
	case db.FieldTypeJSON:
		return "Json"
	case db.FieldTypeNumeric, db.FieldTypeReal, db.FieldTypeDoublePrecision:
		return "Float"
	case db.FieldTypeBytea:
		return "Bytes"
	default:
		if enumSet[string(t)] {
			return db.Capitalize(string(t))
		}
		return "String // " + string(t)
	}
}

func mapDrizzleType(name string, t db.FieldType, isPk bool, enumLookup map[string]db.EnumType) string {
	if isPk {
		if t == db.FieldTypeUUID {
			// No built-in random-UUID default in mysql-core the way
			// pg-core's .defaultRandom() works; caller needs to add
			// .$defaultFn(() => crypto.randomUUID()) manually.
			return fmt.Sprintf("varchar('%s', { length: 36 }).primaryKey()", name)
		}
		if t == db.FieldTypeBigint || t == db.FieldTypeBigserial {
			return fmt.Sprintf("bigint('%s', { mode: 'number' }).autoincrement().primaryKey()", name)
		}
		return fmt.Sprintf("int('%s').autoincrement().primaryKey()", name)
	}

	if e, ok := enumLookup[string(t)]; ok {
		values := make([]string, len(e.Values))
		for i, v := range e.Values {
			values[i] = fmt.Sprintf("'%s'", v)
		}
		return fmt.Sprintf("mysqlEnum('%s', [%s])", name, strings.Join(values, ", "))
	}

	switch t {
	case db.FieldTypeVarchar, db.FieldTypeChar, db.FieldTypeUUID:
		return fmt.Sprintf("varchar('%s', { length: 255 })", name)
	case db.FieldTypeText:
		return fmt.Sprintf("text('%s')", name)
	case db.FieldTypeInteger:
		return fmt.Sprintf("int('%s')", name)
	case db.FieldTypeSmallint:
		return fmt.Sprintf("smallint('%s')", name)
	case db.FieldTypeBigint, db.FieldTypeBigserial:
		return fmt.Sprintf("bigint('%s', { mode: 'number' })", name)
	case db.FieldTypeBoolean:
		return fmt.Sprintf("boolean('%s')", name)
	case db.FieldTypeDate:
		return fmt.Sprintf("date('%s')", name)
	case db.FieldTypeTime:
		return fmt.Sprintf("time('%s')", name)
	case db.FieldTypeTimestamp:
		// See types.go: DATETIME (tz-naive) normalizes to Timestamp.
		return fmt.Sprintf("datetime('%s')", name)
	case db.FieldTypeTimestamptz:
		// See types.go: TIMESTAMP (UTC-normalized on read/write) is the
		// closest MySQL analog to Postgres's tz-aware timestamp.
		return fmt.Sprintf("timestamp('%s')", name)
	case db.FieldTypeJSON:
		return fmt.Sprintf("json('%s')", name)
	case db.FieldTypeNumeric:
		return fmt.Sprintf("decimal('%s')", name)
	case db.FieldTypeReal:
		return fmt.Sprintf("float('%s')", name)
	case db.FieldTypeDoublePrecision:
		return fmt.Sprintf("double('%s')", name)
	case db.FieldTypeBytea:
		return fmt.Sprintf("varbinary('%s', { length: 255 })", name)
	default:
		return fmt.Sprintf("text('%s') /* %s */", name, string(t))
	}
}

func drizzleImports(t db.FieldType, isPk bool, enumLookup map[string]db.EnumType) []string {
	if isPk {
		if t == db.FieldTypeUUID {
			return []string{"varchar"}
		}
		if t == db.FieldTypeBigint || t == db.FieldTypeBigserial {
			return []string{"bigint"}
		}
		return []string{"int"}
	}

	if _, ok := enumLookup[string(t)]; ok {
		return []string{"mysqlEnum"}
	}

	switch t {
	case db.FieldTypeVarchar, db.FieldTypeChar, db.FieldTypeUUID:
		return []string{"varchar"}
	case db.FieldTypeText:
		return []string{"text"}
	case db.FieldTypeInteger:
		return []string{"int"}
	case db.FieldTypeSmallint:
		return []string{"smallint"}
	case db.FieldTypeBigint, db.FieldTypeBigserial:
		return []string{"bigint"}
	case db.FieldTypeBoolean:
		return []string{"boolean"}
	case db.FieldTypeDate:
		return []string{"date"}
	case db.FieldTypeTime:
		return []string{"time"}
	case db.FieldTypeTimestamp:
		return []string{"datetime"}
	case db.FieldTypeTimestamptz:
		return []string{"timestamp"}
	case db.FieldTypeJSON:
		return []string{"json"}
	case db.FieldTypeNumeric:
		return []string{"decimal"}
	case db.FieldTypeReal:
		return []string{"float"}
	case db.FieldTypeDoublePrecision:
		return []string{"double"}
	case db.FieldTypeBytea:
		return []string{"varbinary"}
	default:
		return []string{"text"}
	}
}
