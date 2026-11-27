package mysql

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/knnedy/nexusql/internal/db"
)

// where is this dialect's WHERE builder for rows of t.
func (p *provider) where(t db.Table) db.Where {
	return db.Where{
		Quote: quoteIdent,
		Param: func(int) string { return "?" },
		// LOWER() on both sides: case-insensitive whatever the column collation.
		ILike:      func(col, param string) string { return "LOWER(" + col + ") LIKE LOWER(" + param + ")" },
		Arg:        func(f db.Field, v string) any { return editArg(f, &v) },
		Searchable: func(f db.Field) bool { return searchable(t, f) },
	}
}

func (p *provider) FetchRows(ctx context.Context, req db.RowsRequest) ([]string, []map[string]any, error) {
	w := p.where(req.Table)
	clause, args, err := w.Clause(req)
	if err != nil {
		return nil, nil, err
	}
	offset := req.Offset
	if len(req.After) > 0 {
		offset = 0
	}
	query := "SELECT * FROM " + p.QuoteTable(req.Table) + clause + w.Order(req) +
		" LIMIT " + w.Param(len(args)+1) + " OFFSET " + w.Param(len(args)+2)
	rows, err := p.conn.QueryContext(ctx, query, append(args, req.Limit, offset)...)
	if err != nil {
		return nil, nil, fmt.Errorf("query rows: %w", err)
	}
	defer rows.Close()
	return scanRows(rows)
}

func (p *provider) CountRows(ctx context.Context, req db.RowsRequest) (int64, error) {
	req.After = nil // the count covers every page
	clause, args, err := p.where(req.Table).Clause(req)
	if err != nil {
		return 0, err
	}
	var total int64
	if err := p.conn.QueryRowContext(ctx, "SELECT COUNT(*) FROM "+p.QuoteTable(req.Table)+clause, args...).Scan(&total); err != nil {
		return 0, fmt.Errorf("count rows: %w", err)
	}
	return total, nil
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

func (p *provider) UpdateRow(ctx context.Context, t db.Table, key []db.KeyValue, target db.Field, value *string) error {
	where := make([]string, len(key))
	args := []any{editArg(target, value)}
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

// editArg converts the text the grid shows back into the column's type; nil is NULL.
func editArg(f db.Field, v *string) any {
	if v == nil {
		return nil
	}
	s := *v
	switch f.Type {
	case db.FieldTypeBytea:
		if b, ok := db.ParseHex(s); ok {
			return b
		}
	case db.FieldTypeBoolean:
		switch strings.ToLower(s) {
		case "true":
			return 1
		case "false":
			return 0
		}
	case db.FieldTypeTimestamptz:
		// MySQL rejects a Z suffix; the session is UTC, so send the instant.
		if t, err := time.Parse(time.RFC3339Nano, s); err == nil {
			return t.UTC()
		}
	}
	return s
}

// scanRows reads all rows from a *sql.Rows into a column list and a slice
// of generic maps, converting each value via normalizeValue.
func scanRows(rows *sql.Rows) ([]string, []map[string]any, error) {
	res, err := scanRowsCapped(rows, 0)
	return res.Columns, res.Rows, err
}

// scanRowsCapped reads at most maxRows rows (0: all), noting whether more existed.
func scanRowsCapped(rows *sql.Rows, maxRows int) (db.QueryResult, error) {
	columns, err := rows.Columns()
	if err != nil {
		return db.QueryResult{}, fmt.Errorf("get columns: %w", err)
	}

	colTypes, err := rows.ColumnTypes()
	if err != nil {
		return db.QueryResult{}, fmt.Errorf("get column types: %w", err)
	}
	declaredTypes := make([]string, len(colTypes))
	for i, ct := range colTypes {
		declaredTypes[i] = ct.DatabaseTypeName()
	}

	result := make([]map[string]any, 0)
	truncated := false
	for rows.Next() {
		if maxRows > 0 && len(result) == maxRows {
			truncated = true
			break
		}
		values := make([]any, len(columns))
		scanArgs := make([]any, len(columns))
		for i := range values {
			scanArgs[i] = &values[i]
		}
		if err := rows.Scan(scanArgs...); err != nil {
			return db.QueryResult{}, fmt.Errorf("scan row: %w", err)
		}

		row := make(map[string]any, len(columns))
		for i, col := range columns {
			row[col] = normalizeValue(values[i], declaredTypes[i])
		}
		result = append(result, row)
	}
	if err := rows.Err(); err != nil {
		return db.QueryResult{}, err
	}
	types := make([]string, len(declaredTypes))
	for i, t := range declaredTypes {
		types[i] = strings.ToLower(t)
	}
	return db.QueryResult{Columns: columns, ColumnTypes: types, Rows: result, Truncated: truncated}, nil
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

// normalizeValue makes a scanned value JSON-safe. The driver returns []byte
// for text, DECIMAL and JSON alike, so declaredType (DatabaseTypeName) decides.
func normalizeValue(v any, declaredType string) any {
	declaredType = strings.ToUpper(declaredType)
	switch x := v.(type) {
	case []byte:
		switch {
		case blobTypeNames[declaredType]:
			return db.Hex(x)
		case declaredType == "JSON":
			return db.JSONValue(x)
		}
		return string(x) // DECIMAL included: exact digits as text
	case time.Time:
		switch declaredType {
		case "DATE":
			return db.Date(x)
		case "DATETIME":
			return db.LocalTime(x)
		}
		return db.Instant(x) // TIMESTAMP, read in the UTC session time zone
	}
	return db.WireValue(v)
}

// quoteIdent quotes a MySQL identifier with backticks, doubling any
// embedded backtick per MySQL's escaping rules. This is the first file in
// the mysql package needing identifier quoting — schema.go's queries use
// only bound parameters, no dynamic identifiers.
func quoteIdent(name string) string {
	return "`" + strings.ReplaceAll(name, "`", "``") + "`"
}
