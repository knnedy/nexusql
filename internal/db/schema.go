package db

import (
	"context"
	"fmt"
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

type Schema struct {
	Tables    []Table    `json:"tables"`
	Relations []Relation `json:"relations"`
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

	return &Schema{
		Tables:    tables,
		Relations: relations,
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
				Fields: make([]Field, 0), // Guard against frontend rendering crashes
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

	relations := make([]Relation, 0) // Guard layout mapping array targets

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
			row[col] = values[i]
		}
		result = append(result, row)
	}

	if err := rows.Err(); err != nil {
		return nil, nil, err
	}

	return columns, result, nil
}

func GeneratePrisma(schema *Schema) string {
	var sb strings.Builder

	sb.WriteString("datasource db {\n  provider = \"postgresql\"\n  url      = env(\"DATABASE_URL\")\n}\n\ngenerator client {\n  provider = \"prisma-client-js\"\n}\n\n")

	for _, t := range schema.Tables {
		sb.WriteString(fmt.Sprintf("model %s {\n", capitalize(t.Name)))
		for _, f := range t.Fields {
			line := fmt.Sprintf("  %s  %s", f.Name, mapPrismaType(f.Type))
			if f.IsPrimaryKey {
				line += "  @id @default(autoincrement())"
			}
			sb.WriteString(line)
			sb.WriteString("\n")
		}
		sb.WriteString("}\n\n")
	}

	return strings.TrimSpace(sb.String())
}

func GenerateDrizzle(schema *Schema) string {
	var sb strings.Builder

	sb.WriteString("import { pgTable, serial, text, varchar, timestamp } from 'drizzle-orm/pg-core';\n\n")

	for _, t := range schema.Tables {
		sb.WriteString(fmt.Sprintf("export const %s = pgTable('%s', {\n", t.Name, t.Name))
		for _, f := range t.Fields {
			sb.WriteString(fmt.Sprintf("  %s: %s,\n", f.Name, mapDrizzleType(f.Name, f.Type, f.IsPrimaryKey)))
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

func mapPrismaType(t string) string {
	switch t {
	case "serial", "integer", "smallint", "bigint", "bigserial":
		return "Int"
	case "varchar", "text", "char", "uuid":
		return "String"
	case "boolean":
		return "Boolean"
	case "timestamp", "timestamptz":
		return "DateTime"
	case "json", "jsonb":
		return "Json"
	case "numeric", "real", "double precision":
		return "Float"
	default:
		return "String"
	}
}

func mapDrizzleType(name, t string, isPk bool) string {
	if isPk {
		return fmt.Sprintf("serial('%s').primaryKey()", name)
	}
	switch t {
	case "varchar", "char":
		return fmt.Sprintf("varchar('%s', { length: 255 })", name)
	case "text":
		return fmt.Sprintf("text('%s')", name)
	case "integer", "smallint":
		return fmt.Sprintf("integer('%s')", name)
	case "bigint", "bigserial":
		return fmt.Sprintf("bigint('%s', { mode: 'number' })", name)
	case "boolean":
		return fmt.Sprintf("boolean('%s')", name)
	case "timestamp", "timestamptz":
		return fmt.Sprintf("timestamp('%s')", name)
	case "uuid":
		return fmt.Sprintf("uuid('%s')", name)
	case "json", "jsonb":
		return fmt.Sprintf("jsonb('%s')", name)
	default:
		return fmt.Sprintf("text('%s')", name)
	}
}
