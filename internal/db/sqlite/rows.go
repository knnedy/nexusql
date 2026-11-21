package sqlite

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
				// SQLite has no ILIKE; LOWER() on both sides is the ASCII equivalent.
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

// searchable reports whether search matches against f (text-like columns).
func searchable(t db.Table, f db.Field) bool {
	switch f.Type {
	case db.FieldTypeText, db.FieldTypeVarchar, db.FieldTypeChar,
		db.FieldTypeUUID, db.FieldTypeJSON, db.FieldTypeJSONB:
		return true
	}
	return false
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

func (p *provider) UpdateRow(ctx context.Context, t db.Table, key []db.KeyValue, target db.Field, value *string) error {
	where := make([]string, len(key))
	args := []any{nullable(value)}
	for i, k := range key {
		where[i] = quoteIdent(k.Field.Name) + " = ?"
		args = append(args, k.Value)
	}
	query := fmt.Sprintf("UPDATE %s SET %s = ? WHERE %s",
		p.QuoteTable(t), quoteIdent(target.Name), strings.Join(where, " AND "))

	result, err := p.conn.ExecContext(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("update row: %w", err)
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("check rows affected: %w", err)
	}
	if affected == 0 {
		return db.ErrRowNotFound
	}
	return nil
}

// nullable maps a nil value to SQL NULL.
func nullable(v *string) any {
	if v == nil {
		return nil
	}
	return *v
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
