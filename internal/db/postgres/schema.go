package postgres

import (
	"context"
	"fmt"

	"github.com/knnedy/nexusql/internal/db"
)

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

func (p *provider) IntrospectSchema(ctx context.Context, schema string) (*db.Schema, error) {
	if schema == "" {
		schema = "public"
	}

	tables, err := p.introspectTables(ctx, schema)
	if err != nil {
		return nil, fmt.Errorf("introspect tables: %w", err)
	}

	relations, err := p.introspectRelations(ctx, schema)
	if err != nil {
		return nil, fmt.Errorf("introspect relations: %w", err)
	}

	enums, err := p.introspectEnums(ctx, schema)
	if err != nil {
		return nil, fmt.Errorf("introspect enums: %w", err)
	}

	return &db.Schema{
		Tables:    tables,
		Relations: relations,
		Enums:     enums,
	}, nil
}

func (p *provider) introspectTables(ctx context.Context, schema string) ([]db.Table, error) {
	rows, err := p.pool.Query(ctx, queryTables, schema)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tableMap := make(map[string]*db.Table)
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
			tableMap[tableName] = &db.Table{
				Name:   tableName,
				Schema: tableSchema,
				Fields: make([]db.Field, 0),
			}
			tableOrder = append(tableOrder, tableName)
		}

		tableMap[tableName].Fields = append(tableMap[tableName].Fields, db.Field{
			Name:         columnName,
			Type:         normalizeType(udtName),
			Nullable:     isNullable == "YES",
			IsPrimaryKey: isPrimaryKey,
			IsForeignKey: isForeignKey,
			DefaultValue: columnDef,
		})
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	tables := make([]db.Table, 0, len(tableOrder))
	for _, name := range tableOrder {
		tables = append(tables, *tableMap[name])
	}

	return tables, nil
}

func (p *provider) introspectRelations(ctx context.Context, schema string) ([]db.Relation, error) {
	rows, err := p.pool.Query(ctx, queryRelations, schema)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	relations := make([]db.Relation, 0)

	for rows.Next() {
		var r db.Relation
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

func (p *provider) introspectEnums(ctx context.Context, schema string) ([]db.EnumType, error) {
	rows, err := p.pool.Query(ctx, queryEnums, schema)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	enumMap := make(map[string]*db.EnumType)
	enumOrder := []string{}

	for rows.Next() {
		var name, value string
		if err := rows.Scan(&name, &value); err != nil {
			return nil, fmt.Errorf("scan enum: %w", err)
		}
		if _, exists := enumMap[name]; !exists {
			enumMap[name] = &db.EnumType{Name: name, Values: []string{}}
			enumOrder = append(enumOrder, name)
		}
		enumMap[name].Values = append(enumMap[name].Values, value)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	enums := make([]db.EnumType, 0, len(enumOrder))
	for _, name := range enumOrder {
		enums = append(enums, *enumMap[name])
	}

	return enums, nil
}
