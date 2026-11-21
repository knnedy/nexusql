package mysql

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/knnedy/nexusql/internal/db"
)

func (p *provider) FetchRows(ctx context.Context, req db.RowsRequest) ([]string, []map[string]any, int64, error) {
	table := p.QuoteTable(req.Table)

	whereClause := ""
	var searchArgs []any
	if req.Search != "" {
		var conditions []string
		for _, f := range req.Table.Fields {
			if searchable(req.Table, f) {
				// LOWER() on both sides: case-insensitive whatever the column collation.
				conditions = append(conditions, fmt.Sprintf("LOWER(%s) LIKE LOWER(?)", quoteIdent(f.Name)))
				searchArgs = append(searchArgs, "%"+req.Search+"%")
			}
		}
		if len(conditions) > 0 {
			whereClause = " WHERE " + strings.Join(conditions, " OR ")
		}
	}

	var total int64
	if err := p.conn.QueryRowContext(ctx, "SELECT COUNT(*) FROM "+table+whereClause, searchArgs...).Scan(&total); err != nil {
		return nil, nil, 0, fmt.Errorf("count rows: %w", err)
	}

	query := "SELECT * FROM " + table + whereClause
	if req.Sort != nil {
		dir := "ASC"
		if req.SortDir == db.SortDesc {
			dir = "DESC"
		}
		query += fmt.Sprintf(" ORDER BY %s %s", quoteIdent(req.Sort.Name), dir)
	}
	query += " LIMIT ? OFFSET ?"

	// copy so the count query's args are never aliased
	dataArgs := append(append([]any{}, searchArgs...), req.Limit, req.Offset)
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

// searchable reports whether search matches against f: text-like columns and
// enums, which introspection types as their synthesized per-column name.
func searchable(t db.Table, f db.Field) bool {
	switch f.Type {
	case db.FieldTypeText, db.FieldTypeVarchar, db.FieldTypeChar, db.FieldTypeJSON:
		return true
	}
	return f.Type == db.FieldType(enumTypeName(t.Name, f.Name))
}

func (p *provider) FetchRowWhere(ctx context.Context, t db.Table, f db.Field, value string) ([]string, []map[string]any, error) {
	query := fmt.Sprintf("SELECT * FROM %s WHERE %s = ? LIMIT 100", p.QuoteTable(t), quoteIdent(f.Name))
	rows, err := p.conn.QueryContext(ctx, query, value)
	if err != nil {
		return nil, nil, fmt.Errorf("query rows: %w", err)
	}
	defer rows.Close()
	return scanRows(rows)
}

func (p *provider) UpdateRow(ctx context.Context, t db.Table, pk db.Field, pkValue string, target db.Field, newValue string) error {
	query := fmt.Sprintf("UPDATE %s SET %s = ? WHERE %s = ?",
		p.QuoteTable(t), quoteIdent(target.Name), quoteIdent(pk.Name))

	result, err := p.conn.ExecContext(ctx, query, newValue, pkValue)
	if err != nil {
		return fmt.Errorf("update row: %w", err)
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("check rows affected: %w", err)
	}
	if affected == 0 {
		return fmt.Errorf("no row found with %s = %s", pk.Name, pkValue)
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
