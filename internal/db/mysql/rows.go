package mysql

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/knnedy/nexusql/internal/db"
)

func (p *provider) FetchRows(ctx context.Context, tableName string, limit, offset int, sortCol string, sortDir db.SortDir, search string) ([]string, []map[string]any, int64, error) {
	searchCols, err := p.getTextColumns(ctx, tableName)
	if err != nil {
		return nil, nil, 0, fmt.Errorf("get text columns: %w", err)
	}

	whereClause := ""
	var searchArgs []any

	if search != "" && len(searchCols) > 0 {
		conditions := make([]string, len(searchCols))
		for i, col := range searchCols {
			// MySQL's default collation is often case-insensitive, but that
			// depends on the column's charset/collation and isn't
			// guaranteed — LOWER()/LOWER() makes the match explicit and
			// collation-independent, matching the SQLite provider's approach.
			conditions[i] = fmt.Sprintf("LOWER(%s) LIKE LOWER(?)", quoteIdent(col))
			searchArgs = append(searchArgs, "%"+search+"%")
		}
		whereClause = " WHERE " + strings.Join(conditions, " OR ")
	}

	var total int64
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM %s%s", quoteIdent(tableName), whereClause)
	if err := p.conn.QueryRowContext(ctx, countQuery, searchArgs...).Scan(&total); err != nil {
		return nil, nil, 0, fmt.Errorf("count rows: %w", err)
	}

	query := fmt.Sprintf("SELECT * FROM %s%s", quoteIdent(tableName), whereClause)

	if sortCol != "" {
		dir := "ASC"
		if sortDir == db.SortDesc {
			dir = "DESC"
		}
		query += fmt.Sprintf(" ORDER BY %s %s", quoteIdent(sortCol), dir)
	}

	query += " LIMIT ? OFFSET ?"

	// Copy searchArgs rather than append directly onto it, so the slice
	// backing the earlier count query's args is never mutated/aliased.
	dataArgs := append(append([]any{}, searchArgs...), limit, offset)

	rows, err := p.conn.QueryContext(ctx, query, dataArgs...)
	if err != nil {
		return nil, nil, 0, fmt.Errorf("query rows: %w", err)
	}
	defer rows.Close()

	columns, result, err := scanRows(rows)
	if err != nil {
		return nil, nil, 0, err
	}

	return columns, result, total, nil
}

// getTableColumns lists a table's column names, scoped to the connection's
// current database via DATABASE() rather than a stored schema value —
// mirroring resolveSchema's fallback in schema.go. The table name comes
// from API input, so it's bound as a parameter, never interpolated into
// SQL text.
func (p *provider) getTableColumns(ctx context.Context, tableName string) ([]string, error) {
	rows, err := p.conn.QueryContext(ctx,
		`SELECT COLUMN_NAME FROM information_schema.columns
		 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
		 ORDER BY ORDINAL_POSITION`, tableName)
	if err != nil {
		return nil, fmt.Errorf("get columns: %w", err)
	}
	defer rows.Close()

	var cols []string
	for rows.Next() {
		var col string
		if err := rows.Scan(&col); err != nil {
			return nil, fmt.Errorf("scan column: %w", err)
		}
		cols = append(cols, col)
	}
	return cols, rows.Err()
}

// getTextColumns returns the subset of a table's columns whose canonical
// FieldType is text-like, for building the search WHERE clause. ENUM
// columns are included by DATA_TYPE directly, since normalizeType maps
// them to a synthesized per-column type name (see schema.go) rather than
// one of the FieldType text constants.
func (p *provider) getTextColumns(ctx context.Context, tableName string) ([]string, error) {
	rows, err := p.conn.QueryContext(ctx,
		`SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE FROM information_schema.columns
		 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
		 ORDER BY ORDINAL_POSITION`, tableName)
	if err != nil {
		return nil, fmt.Errorf("get text columns: %w", err)
	}
	defer rows.Close()

	var cols []string
	for rows.Next() {
		var name, dataType, columnType string
		if err := rows.Scan(&name, &dataType, &columnType); err != nil {
			return nil, fmt.Errorf("scan column: %w", err)
		}

		isEnum := strings.ToLower(dataType) == "enum"
		switch normalizeType(dataType, columnType) {
		case db.FieldTypeText, db.FieldTypeVarchar, db.FieldTypeChar, db.FieldTypeJSON:
			cols = append(cols, name)
		default:
			if isEnum {
				cols = append(cols, name)
			}
		}
	}
	return cols, rows.Err()
}

func (p *provider) FetchRowWhere(ctx context.Context, tableName, field, value string) ([]string, []map[string]any, error) {
	validCols, err := p.getTableColumns(ctx, tableName)
	if err != nil {
		return nil, nil, fmt.Errorf("validate field: %w", err)
	}

	fieldValid := false
	for _, col := range validCols {
		if col == field {
			fieldValid = true
			break
		}
	}
	if !fieldValid {
		return nil, nil, fmt.Errorf("invalid field: %s", field)
	}

	query := fmt.Sprintf(
		"SELECT * FROM %s WHERE %s = ? LIMIT 100",
		quoteIdent(tableName),
		quoteIdent(field),
	)

	rows, err := p.conn.QueryContext(ctx, query, value)
	if err != nil {
		return nil, nil, fmt.Errorf("query rows: %w", err)
	}
	defer rows.Close()

	columns, result, err := scanRows(rows)
	if err != nil {
		return nil, nil, err
	}

	return columns, result, nil
}

func (p *provider) UpdateRow(ctx context.Context, tableName, pkField, pkValue, targetField, newValue string) error {
	validCols, err := p.getTableColumns(ctx, tableName)
	if err != nil {
		return fmt.Errorf("validate columns: %w", err)
	}

	colSet := make(map[string]bool, len(validCols))
	for _, col := range validCols {
		colSet[col] = true
	}

	if !colSet[pkField] {
		return fmt.Errorf("invalid pk field: %s", pkField)
	}
	if !colSet[targetField] {
		return fmt.Errorf("invalid target field: %s", targetField)
	}

	query := fmt.Sprintf(
		"UPDATE %s SET %s = ? WHERE %s = ?",
		quoteIdent(tableName),
		quoteIdent(targetField),
		quoteIdent(pkField),
	)

	result, err := p.conn.ExecContext(ctx, query, newValue, pkValue)
	if err != nil {
		return fmt.Errorf("update row: %w", err)
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("check rows affected: %w", err)
	}
	if affected == 0 {
		return fmt.Errorf("no row found with %s = %s", pkField, pkValue)
	}

	return nil
}

// scanRows reads all rows from a *sql.Rows into a column list and a slice
// of generic maps, converting each value via normalizeValue.
func scanRows(rows *sql.Rows) ([]string, []map[string]any, error) {
	columns, err := rows.Columns()
	if err != nil {
		return nil, nil, fmt.Errorf("get columns: %w", err)
	}

	colTypes, err := rows.ColumnTypes()
	if err != nil {
		return nil, nil, fmt.Errorf("get column types: %w", err)
	}
	declaredTypes := make([]string, len(colTypes))
	for i, ct := range colTypes {
		declaredTypes[i] = ct.DatabaseTypeName()
	}

	result := make([]map[string]any, 0)
	for rows.Next() {
		values := make([]any, len(columns))
		scanArgs := make([]any, len(columns))
		for i := range values {
			scanArgs[i] = &values[i]
		}
		if err := rows.Scan(scanArgs...); err != nil {
			return nil, nil, fmt.Errorf("scan row: %w", err)
		}

		row := make(map[string]any, len(columns))
		for i, col := range columns {
			row[col] = normalizeValue(values[i], declaredTypes[i])
		}
		result = append(result, row)
	}
	if err := rows.Err(); err != nil {
		return nil, nil, err
	}

	return columns, result, nil
}

// blobTypeNames are the driver-reported ColumnType.DatabaseTypeName()
// values for MySQL's binary-affinity types, per go-sql-driver/mysql's type
// mapping. Unlike SQLite's dynamic typing — where declared column affinity
// is the only way to disambiguate text from blob — MySQL's driver reports
// a precise static type per column, so this only needs to be a small fixed
// set rather than a full FieldType lookup.
var blobTypeNames = map[string]bool{
	"BLOB":       true,
	"TINYBLOB":   true,
	"MEDIUMBLOB": true,
	"LONGBLOB":   true,
	"BINARY":     true,
	"VARBINARY":  true,
}

// normalizeValue converts driver-scanned values for JSON serialization.
// go-sql-driver/mysql returns []byte for most textual and numeric types
// (VARCHAR, TEXT, DECIMAL, JSON, ENUM) as well as genuine binary columns.
// declaredType (the driver's DatabaseTypeName(), not the runtime value)
// disambiguates: binary-affinity columns stay []byte, everything else is
// converted to string.
func normalizeValue(v any, declaredType string) any {
	b, ok := v.([]byte)
	if !ok {
		return v
	}
	if blobTypeNames[strings.ToUpper(declaredType)] {
		return b
	}
	return string(b)
}

// quoteIdent quotes a MySQL identifier with backticks, doubling any
// embedded backtick per MySQL's escaping rules. This is the first file in
// the mysql package needing identifier quoting — schema.go's queries use
// only bound parameters, no dynamic identifiers.
func quoteIdent(name string) string {
	return "`" + strings.ReplaceAll(name, "`", "``") + "`"
}
