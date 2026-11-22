package mysql

import (
	"context"
	"database/sql"
	"fmt"
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
    k.ORDINAL_POSITION,
    r.DELETE_RULE,
    r.UPDATE_RULE
FROM information_schema.key_column_usage k
JOIN information_schema.REFERENTIAL_CONSTRAINTS r
  ON r.CONSTRAINT_SCHEMA = k.TABLE_SCHEMA AND r.CONSTRAINT_NAME = k.CONSTRAINT_NAME AND r.TABLE_NAME = k.TABLE_NAME
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
	if err := p.introspectUnique(ctx, schema, tables); err != nil {
		return nil, fmt.Errorf("introspect unique indexes: %w", err)
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
	onDelete       string
	onUpdate       string
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
			&r.onDelete,
			&r.onUpdate,
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
		group := groups[key] // rows arrive in ORDINAL_POSITION order
		var src, dst []string
		for _, r := range group {
			src = append(src, r.columnName)
			dst = append(dst, r.refColumn)
		}
		relations = append(relations, db.Relation{
			ConstraintName: group[0].constraintName,
			SourceTable:    group[0].tableName,
			SourceField:    src[0],
			TargetTable:    group[0].refTable,
			TargetField:    dst[0],
			SourceFields:   src,
			TargetFields:   dst,
			OnDelete:       db.RefAction(group[0].onDelete),
			OnUpdate:       db.RefAction(group[0].onUpdate),
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
			enumName := enumTypeName(tableName, columnName)
			enums = append(enums, db.EnumType{Name: enumName, Values: values})
			fieldType = db.FieldType(enumName)
		}

		var defaultValue *string
		if columnDef.Valid {
			v := defaultExpr(columnDef.String, dataType, extra)
			defaultValue = &v
		}

		tableMap[tableName].Fields = append(tableMap[tableName].Fields, db.Field{
			Name:          columnName,
			Type:          fieldType,
			Nullable:      isNullable == "YES",
			IsPrimaryKey:  columnKey == "PRI",
			IsForeignKey:  fkCols[tableName][columnName],
			AutoGenerated: strings.Contains(strings.ToLower(extra), "auto_increment"),
			DefaultValue:  defaultValue,
			NativeType:    columnType,
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

// DefaultSchema returns "" so callers fall through to resolveSchema's
// SELECT DATABASE() fallback, rather than a hardcoded literal that would
// never match the user's actual database name.
func (p *provider) DefaultSchema() string {
	return ""
}

// enumTypeName names the synthesized type of an inline MySQL ENUM column.
func enumTypeName(table, column string) string {
	return table + "_" + column
}

// defaultExpr turns COLUMN_DEFAULT, which shows literals unquoted, into the SQL
// expression a CREATE TABLE would carry.
func defaultExpr(v, dataType, extra string) string {
	switch {
	case strings.Contains(strings.ToUpper(extra), "DEFAULT_GENERATED"):
		if strings.HasPrefix(strings.ToUpper(v), "CURRENT_TIMESTAMP") {
			return v
		}
		return "(" + v + ")" // only CURRENT_TIMESTAMP may go without parentheses
	case numericTypes[strings.ToLower(dataType)]:
		return v
	default:
		return "'" + strings.ReplaceAll(v, "'", "''") + "'"
	}
}

var numericTypes = map[string]bool{
	"tinyint": true, "smallint": true, "mediumint": true, "int": true, "integer": true, "bigint": true,
	"decimal": true, "numeric": true, "float": true, "double": true, "bit": true,
}
