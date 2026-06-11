package db

import (
	"context"
	"fmt"
)

type Field struct {
	Name         string
	Type         string
	Nullable     bool
	IsPrimaryKey bool
	IsForeignKey bool
	DefaultValue *string
}

type Table struct {
	Name   string
	Schema string
	Fields []Field
}

type Relation struct {
	ConstraintName string
	SourceTable    string
	SourceField    string
	TargetTable    string
	TargetField    string
}

type Schema struct {
	Tables    []Table
	Relations []Relation
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
    AND tc.table_schema = ccu.table_schema
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
				Fields: []Field{},
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

	var relations []Relation

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

	var result []map[string]any
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
