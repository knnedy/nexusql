package sqlite

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
			// SQLite has no ILIKE; LOWER()/LOWER() gives case-insensitive
			// matching equivalent to Postgres's ILIKE for ASCII text.
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

// getTableColumns lists a table's column names via the pragma_table_info
// table-valued function (not the "PRAGMA table_info(name)" statement form
// used in schema.go), because this form accepts a bound parameter — the
// table name here comes from API input, not from our own trusted
// sqlite_master listing, so it should never be interpolated into SQL text.
func (p *provider) getTableColumns(ctx context.Context, tableName string) ([]string, error) {
	rows, err := p.conn.QueryContext(ctx,
		`SELECT name FROM pragma_table_info(?) ORDER BY cid`, tableName)
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
// FieldType is text-like, for building the search WHERE clause.
func (p *provider) getTextColumns(ctx context.Context, tableName string) ([]string, error) {
	rows, err := p.conn.QueryContext(ctx,
		`SELECT name, type FROM pragma_table_info(?) ORDER BY cid`, tableName)
	if err != nil {
		return nil, fmt.Errorf("get text columns: %w", err)
	}
	defer rows.Close()

	var cols []string
	for rows.Next() {
		var name, declType string
		if err := rows.Scan(&name, &declType); err != nil {
			return nil, fmt.Errorf("scan column: %w", err)
		}
		switch normalizeType(declType) {
		case db.FieldTypeText, db.FieldTypeVarchar, db.FieldTypeChar,
			db.FieldTypeUUID, db.FieldTypeJSON, db.FieldTypeJSONB:
			cols = append(cols, name)
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

// normalizeValue converts driver-scanned values for JSON serialization.
// database/sql with modernc.org/sqlite returns []byte for any column whose
// affinity isn't INTEGER/REAL — that includes TEXT, UUID, and JSON columns
// as well as genuine BLOB columns, with no way to tell them apart from the
// Go value alone. declaredType (from the column's schema, not the runtime
// value) disambiguates: BLOB-affinity columns stay []byte, everything else
// is converted to string.
func normalizeValue(v any, declaredType string) any {
	b, ok := v.([]byte)
	if !ok {
		return v
	}
	if normalizeType(declaredType) == db.FieldTypeBytea {
		return b
	}
	return string(b)
}
