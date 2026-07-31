package mysql

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"strings"

	"github.com/knnedy/nexusql/internal/db"
)

const queryColumns = `
SELECT
    c.TABLE_NAME,
    c.COLUMN_NAME,
    c.DATA_TYPE,
    c.COLUMN_TYPE,
    c.IS_NULLABLE,
    c.COLUMN_DEFAULT,
    c.COLUMN_KEY,
    c.EXTRA
FROM information_schema.columns c
WHERE c.TABLE_SCHEMA = ?
ORDER BY c.TABLE_NAME, c.ORDINAL_POSITION
`

const queryForeignKeys = `
SELECT
    k.CONSTRAINT_NAME,
    k.TABLE_NAME,
    k.COLUMN_NAME,
    k.REFERENCED_TABLE_NAME,
    k.REFERENCED_COLUMN_NAME,
    k.ORDINAL_POSITION
FROM information_schema.key_column_usage k
WHERE k.TABLE_SCHEMA = ?
  AND k.REFERENCED_TABLE_NAME IS NOT NULL
ORDER BY k.TABLE_NAME, k.CONSTRAINT_NAME, k.ORDINAL_POSITION
`

func (p *provider) IntrospectSchema(ctx context.Context, schema string) (*db.Schema, error) {
	schema, err := p.resolveSchema(ctx, schema)
	if err != nil {
		return nil, fmt.Errorf("resolve schema: %w", err)
	}

	relations, fkCols, err := p.introspectForeignKeys(ctx, schema)
	if err != nil {
		return nil, fmt.Errorf("introspect foreign keys: %w", err)
	}

	tables, enums, err := p.introspectColumns(ctx, schema, fkCols)
	if err != nil {
		return nil, fmt.Errorf("introspect columns: %w", err)
	}

	return &db.Schema{
		Tables:    tables,
		Relations: relations,
		Enums:     enums,
	}, nil
}

// resolveSchema returns the database to introspect. Unlike Postgres, MySQL
// has no separate "public"-style default schema — schema and database are
// the same concept — so an empty schema falls back to whatever database
// the connection's DSN selected, via SELECT DATABASE().
func (p *provider) resolveSchema(ctx context.Context, schema string) (string, error) {
	if schema != "" {
		return schema, nil
	}

	var dbName sql.NullString
	if err := p.conn.QueryRowContext(ctx, "SELECT DATABASE()").Scan(&dbName); err != nil {
		return "", fmt.Errorf("query current database: %w", err)
	}
	if !dbName.Valid || dbName.String == "" {
		return "", fmt.Errorf("no database selected on this connection")
	}
	return dbName.String, nil
}

type fkRow struct {
	constraintName string
	tableName      string
	columnName     string
	refTable       string
	refColumn      string
	ordinalPos     int
}

// introspectForeignKeys returns single-column relations plus a full
// table->column FK membership set. Composite (multi-column) foreign keys
// are detected by grouping on (TABLE_NAME, CONSTRAINT_NAME) — db.Relation
// can only express one column pair, so a composite key is logged and
// excluded from the relations list rather than collapsed into an
// incorrect single-column edge. Its columns are still marked
// IsForeignKey via fkCols, so the UI can flag them even without a drawable
// relation line.
func (p *provider) introspectForeignKeys(ctx context.Context, schema string) ([]db.Relation, map[string]map[string]bool, error) {
	rows, err := p.conn.QueryContext(ctx, queryForeignKeys, schema)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()

	var all []fkRow
	for rows.Next() {
		var r fkRow
		if err := rows.Scan(
			&r.constraintName,
			&r.tableName,
			&r.columnName,
			&r.refTable,
			&r.refColumn,
			&r.ordinalPos,
		); err != nil {
			return nil, nil, fmt.Errorf("scan foreign key: %w", err)
		}
		all = append(all, r)
	}
	if err := rows.Err(); err != nil {
		return nil, nil, err
	}

	fkCols := make(map[string]map[string]bool)
	groups := make(map[string][]fkRow)
	var groupOrder []string

	for _, r := range all {
		if fkCols[r.tableName] == nil {
			fkCols[r.tableName] = make(map[string]bool)
		}
		fkCols[r.tableName][r.columnName] = true

		key := r.tableName + "\x00" + r.constraintName
		if _, exists := groups[key]; !exists {
			groupOrder = append(groupOrder, key)
		}
		groups[key] = append(groups[key], r)
	}

	relations := make([]db.Relation, 0, len(groupOrder))
	for _, key := range groupOrder {
		group := groups[key]
		if len(group) > 1 {
			log.Printf(
				"mysql: skipping composite foreign key %s on %s (%d columns) — not representable by db.Relation; columns remain flagged IsForeignKey",
				group[0].constraintName, group[0].tableName, len(group),
			)
			continue
		}

		r := group[0]
		relations = append(relations, db.Relation{
			ConstraintName: r.constraintName,
			SourceTable:    r.tableName,
			SourceField:    r.columnName,
			TargetTable:    r.refTable,
			TargetField:    r.refColumn,
		})
	}

	return relations, fkCols, nil
}

func (p *provider) introspectColumns(ctx context.Context, schema string, fkCols map[string]map[string]bool) ([]db.Table, []db.EnumType, error) {
	rows, err := p.conn.QueryContext(ctx, queryColumns, schema)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()

	tableMap := make(map[string]*db.Table)
	var tableOrder []string
	var enums []db.EnumType

	for rows.Next() {
		var (
			tableName  string
			columnName string
			dataType   string
			columnType string
			isNullable string
			columnDef  sql.NullString
			columnKey  string
			extra      string
		)

		if err := rows.Scan(
			&tableName, &columnName, &dataType, &columnType,
			&isNullable, &columnDef, &columnKey, &extra,
		); err != nil {
			return nil, nil, fmt.Errorf("scan column: %w", err)
		}

		if _, exists := tableMap[tableName]; !exists {
			tableMap[tableName] = &db.Table{Name: tableName, Schema: schema, Fields: make([]db.Field, 0)}
			tableOrder = append(tableOrder, tableName)
		}

		fieldType := normalizeType(dataType, columnType)

		// MySQL enums are inline on the column (COLUMN_TYPE =
		// "enum('a','b','c')") rather than a named catalog type, so there's
		// no natural enum name to reuse.
		if strings.ToLower(dataType) == "enum" {
			values, perr := parseEnumValues(columnType)
			if perr != nil {
				return nil, nil, fmt.Errorf("parse enum values for %s.%s: %w", tableName, columnName, perr)
			}
			enumName := fmt.Sprintf("%s_%s", tableName, columnName)
			enums = append(enums, db.EnumType{Name: enumName, Values: values})
			fieldType = db.FieldType(enumName)
		}

		var defaultValue *string
		switch {
		case columnDef.Valid:
			v := columnDef.String
			defaultValue = &v
		case strings.Contains(strings.ToLower(extra), "auto_increment"):
			// AUTO_INCREMENT columns are populated on insert when omitted,
			// same idea as SQLite's INTEGER PRIMARY KEY rowid-aliased columns.
			implicit := "AUTO_INCREMENT"
			defaultValue = &implicit
		}

		tableMap[tableName].Fields = append(tableMap[tableName].Fields, db.Field{
			Name:         columnName,
			Type:         fieldType,
			Nullable:     isNullable == "YES",
			IsPrimaryKey: columnKey == "PRI",
			IsForeignKey: fkCols[tableName][columnName],
			DefaultValue: defaultValue,
		})
	}
	if err := rows.Err(); err != nil {
		return nil, nil, err
	}

	tables := make([]db.Table, 0, len(tableOrder))
	for _, name := range tableOrder {
		tables = append(tables, *tableMap[name])
	}

	return tables, enums, nil
}

// parseEnumValues extracts the literal values from a MySQL COLUMN_TYPE
// string of the form enum('a','b','c').
func parseEnumValues(columnType string) ([]string, error) {
	open := strings.IndexByte(columnType, '(')
	if open == -1 || !strings.HasSuffix(columnType, ")") {
		return nil, fmt.Errorf("malformed enum column type: %q", columnType)
	}
	inner := []rune(columnType[open+1 : len(columnType)-1])

	var values []string
	var current strings.Builder
	inQuote := false

	for i := 0; i < len(inner); i++ {
		c := inner[i]

		if !inQuote {
			if c == '\'' {
				inQuote = true
			}
			continue // commas/whitespace between values are ignored
		}

		if c == '\'' {
			if i+1 < len(inner) && inner[i+1] == '\'' {
				current.WriteRune('\'')
				i++
				continue
			}
			inQuote = false
			values = append(values, current.String())
			current.Reset()
			continue
		}

		current.WriteRune(c)
	}

	if inQuote {
		return nil, fmt.Errorf("malformed enum column type: unterminated quote in %q", columnType)
	}

	return values, nil
}
