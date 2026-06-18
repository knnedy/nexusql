package db

import (
	"context"
	"fmt"
	"sort"
	"strings"
)

type Field struct {
	Name         string  `json:"name"`
	Type         string  `json:"type"`
	Nullable     bool    `json:"nullable"`
	IsPrimaryKey bool    `json:"isPrimaryKey"`
	IsForeignKey bool    `json:"isForeignKey"`
	DefaultValue *string `json:"defaultValue"`
}

type Table struct {
	Name   string  `json:"name"`
	Schema string  `json:"schema"`
	Fields []Field `json:"fields"`
}

type Relation struct {
	ConstraintName string `json:"constraintName"`
	SourceTable    string `json:"sourceTable"`
	SourceField    string `json:"sourceField"`
	TargetTable    string `json:"targetTable"`
	TargetField    string `json:"targetField"`
}

type EnumType struct {
	Name   string   `json:"name"`
	Values []string `json:"values"`
}

type Schema struct {
	Tables    []Table    `json:"tables"`
	Relations []Relation `json:"relations"`
	Enums     []EnumType `json:"enums"`
}

const queryTables = `
SELECT
    c.table_schema,
    c.table_name,
    c.column_name,
    c.udt_name,
    c.is_nullable,
    c.column_default,
    COALESCE(pk.is_pk, false) AS is_primary_key,
    COALESCE(fk.is_fk, false) AS is_foreign_key
FROM information_schema.columns c
LEFT JOIN (
    SELECT ku.table_schema, ku.table_name, ku.column_name, true AS is_pk
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage ku
        ON tc.constraint_name = ku.constraint_name
        AND tc.table_schema = ku.table_schema
    WHERE tc.constraint_type = 'PRIMARY KEY'
) pk ON pk.table_schema = c.table_schema
     AND pk.table_name = c.table_name
     AND pk.column_name = c.column_name
LEFT JOIN (
    SELECT ku.table_schema, ku.table_name, ku.column_name, true AS is_fk
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage ku
        ON tc.constraint_name = ku.constraint_name
        AND tc.table_schema = ku.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
) fk ON fk.table_schema = c.table_schema
     AND fk.table_name = c.table_name
     AND fk.column_name = c.column_name
WHERE c.table_schema NOT IN ('pg_catalog', 'information_schema')
  AND c.table_schema = $1
ORDER BY c.table_name, c.ordinal_position
`

const queryRelations = `
SELECT
    tc.constraint_name,
    tc.table_name        AS source_table,
    kcu.column_name      AS source_field,
    ccu.table_name       AS target_table,
    ccu.column_name      AS target_field
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = $1
ORDER BY tc.constraint_name
`

const queryEnums = `
SELECT
    t.typname      AS enum_name,
    e.enumlabel    AS enum_value
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = $1
ORDER BY t.typname, e.enumsortorder
`

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

func IntrospectSchema(ctx context.Context, conn *Connection, schema string) (*Schema, error) {
	if schema == "" {
		schema = "public"
	}

	tables, err := introspectTables(ctx, conn, schema)
	if err != nil {
		return nil, fmt.Errorf("introspect tables: %w", err)
	}

	relations, err := introspectRelations(ctx, conn, schema)
	if err != nil {
		return nil, fmt.Errorf("introspect relations: %w", err)
	}

	enums, err := introspectEnums(ctx, conn, schema)
	if err != nil {
		return nil, fmt.Errorf("introspect enums: %w", err)
	}

	return &Schema{
		Tables:    tables,
		Relations: relations,
		Enums:     enums,
	}, nil
}

func introspectTables(ctx context.Context, conn *Connection, schema string) ([]Table, error) {
	rows, err := conn.Pool.Query(ctx, queryTables, schema)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tableMap := make(map[string]*Table)
	tableOrder := []string{}

	for rows.Next() {
		var (
			tableSchema  string
			tableName    string
			columnName   string
			udtName      string
			isNullable   string
			columnDef    *string
			isPrimaryKey bool
			isForeignKey bool
		)

		if err := rows.Scan(
			&tableSchema,
			&tableName,
			&columnName,
			&udtName,
			&isNullable,
			&columnDef,
			&isPrimaryKey,
			&isForeignKey,
		); err != nil {
			return nil, fmt.Errorf("scan row: %w", err)
		}

		if _, exists := tableMap[tableName]; !exists {
			tableMap[tableName] = &Table{
				Name:   tableName,
				Schema: tableSchema,
				Fields: make([]Field, 0),
			}
			tableOrder = append(tableOrder, tableName)
		}

		tableMap[tableName].Fields = append(tableMap[tableName].Fields, Field{
			Name:         columnName,
			Type:         udtName,
			Nullable:     isNullable == "YES",
			IsPrimaryKey: isPrimaryKey,
			IsForeignKey: isForeignKey,
			DefaultValue: columnDef,
		})
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	tables := make([]Table, 0, len(tableOrder))
	for _, name := range tableOrder {
		tables = append(tables, *tableMap[name])
	}

	return tables, nil
}

func introspectRelations(ctx context.Context, conn *Connection, schema string) ([]Relation, error) {
	rows, err := conn.Pool.Query(ctx, queryRelations, schema)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	relations := make([]Relation, 0)

	for rows.Next() {
		var r Relation
		if err := rows.Scan(
			&r.ConstraintName,
			&r.SourceTable,
			&r.SourceField,
			&r.TargetTable,
			&r.TargetField,
		); err != nil {
			return nil, fmt.Errorf("scan relation: %w", err)
		}
		relations = append(relations, r)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return relations, nil
}

func introspectEnums(ctx context.Context, conn *Connection, schema string) ([]EnumType, error) {
	rows, err := conn.Pool.Query(ctx, queryEnums, schema)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	enumMap := make(map[string]*EnumType)
	enumOrder := []string{}

	for rows.Next() {
		var name, value string
		if err := rows.Scan(&name, &value); err != nil {
			return nil, fmt.Errorf("scan enum: %w", err)
		}
		if _, exists := enumMap[name]; !exists {
			enumMap[name] = &EnumType{Name: name, Values: []string{}}
			enumOrder = append(enumOrder, name)
		}
		enumMap[name].Values = append(enumMap[name].Values, value)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	enums := make([]EnumType, 0, len(enumOrder))
	for _, name := range enumOrder {
		enums = append(enums, *enumMap[name])
	}

	return enums, nil
}

func FetchRows(ctx context.Context, conn *Connection, tableName string) ([]string, []map[string]any, error) {
	rows, err := conn.Pool.Query(ctx, fmt.Sprintf("SELECT * FROM %q LIMIT 10", tableName))
	if err != nil {
		return nil, nil, fmt.Errorf("query rows: %w", err)
	}
	defer rows.Close()

	fields := rows.FieldDescriptions()
	columns := make([]string, len(fields))
	for i, f := range fields {
		columns[i] = string(f.Name)
	}

	result := make([]map[string]any, 0)
	for rows.Next() {
		values, err := rows.Values()
		if err != nil {
			return nil, nil, fmt.Errorf("scan row: %w", err)
		}
		row := make(map[string]any, len(columns))
		for i, col := range columns {
			row[col] = normalizeValue(values[i])
		}
		result = append(result, row)
	}

	if err := rows.Err(); err != nil {
		return nil, nil, err
	}

	return columns, result, nil
}

func normalizeValue(v any) any {
	switch val := v.(type) {
	case [16]byte:
		return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x",
			val[0:4], val[4:6], val[6:8], val[8:10], val[10:16])
	default:
		return v
	}
}

func GeneratePrisma(schema *Schema) string {
	var sb strings.Builder
	relLookup := buildRelationLookup(schema.Relations)
	enumSet := buildEnumSet(schema.Enums)

	sb.WriteString("datasource db {\n  provider = \"postgresql\"\n  url      = env(\"DATABASE_URL\")\n}\n\n")
	sb.WriteString("generator client {\n  provider = \"prisma-client-js\"\n}\n\n")

	// enums
	for _, e := range schema.Enums {
		sb.WriteString(fmt.Sprintf("enum %s {\n", capitalize(e.Name)))
		for _, v := range e.Values {
			sb.WriteString(fmt.Sprintf("  %s\n", strings.ToUpper(v)))
		}
		sb.WriteString("}\n\n")
	}

	// models
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

		// relation fields
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

	// collect imports
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

	// enum declarations
	for _, e := range schema.Enums {
		values := make([]string, len(e.Values))
		for i, v := range e.Values {
			values[i] = fmt.Sprintf("'%s'", v)
		}
		sb.WriteString(fmt.Sprintf("export const %sEnum = pgEnum('%s', [%s]);\n\n",
			e.Name, e.Name, strings.Join(values, ", ")))
	}

	// table declarations
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

func capitalize(s string) string {
	if s == "" {
		return ""
	}
	return strings.ToUpper(s[:1]) + s[1:]
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
			return []string{} // pgEnum already added at top level
		}
		return []string{"text"}
	}
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
