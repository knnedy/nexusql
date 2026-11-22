package postgres

import (
	"context"
	"database/sql/driver"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/knnedy/nexusql/internal/db"
)

func (p *provider) FetchRows(ctx context.Context, req db.RowsRequest) ([]string, []map[string]any, int64, error) {
	table := p.QuoteTable(req.Table)

	whereClause, whereArgs, err := db.Where{
		Quote:      p.QuoteIdentifier,
		Param:      func(n int) string { return fmt.Sprintf("$%d", n) },
		ILike:      func(col, param string) string { return col + "::text ILIKE " + param },
		Arg:        func(_ db.Field, v string) any { return v },
		Searchable: searchable,
	}.Clause(req)
	if err != nil {
		return nil, nil, 0, err
	}

	var total int64
	if err := p.pool.QueryRow(ctx, "SELECT COUNT(*) FROM "+table+whereClause, whereArgs...).Scan(&total); err != nil {
		return nil, nil, 0, fmt.Errorf("count rows: %w", err)
	}

	query := "SELECT * FROM " + table + whereClause
	if req.Sort != nil {
		dir := "ASC"
		if req.SortDir == db.SortDesc {
			dir = "DESC"
		}
		query += fmt.Sprintf(" ORDER BY %s %s", p.QuoteIdentifier(req.Sort.Name), dir)
	}
	query += fmt.Sprintf(" LIMIT $%d OFFSET $%d", len(whereArgs)+1, len(whereArgs)+2)

	dataArgs := append(append([]any{}, whereArgs...), req.Limit, req.Offset)
	rows, err := p.pool.Query(ctx, query, dataArgs...)
	if err != nil {
		return nil, nil, 0, fmt.Errorf("query rows: %w", err)
	}
	columns, result, err := collect(rows)
	if err != nil {
		return nil, nil, 0, err
	}
	return columns, result, total, nil
}

// searchable reports whether search matches against f (text-like columns).
func searchable(f db.Field) bool {
	switch f.Type {
	case db.FieldTypeText, db.FieldTypeVarchar, db.FieldTypeChar, db.FieldTypeUUID, "name", "citext":
		return true
	}
	return false
}

func (p *provider) FetchRowWhere(ctx context.Context, t db.Table, f db.Field, value string) ([]string, []map[string]any, error) {
	query := fmt.Sprintf("SELECT * FROM %s WHERE %s = $1 LIMIT 100", p.QuoteTable(t), p.QuoteIdentifier(f.Name))
	rows, err := p.pool.Query(ctx, query, value)
	if err != nil {
		return nil, nil, fmt.Errorf("query rows: %w", err)
	}
	return collect(rows)
}

func (p *provider) UpdateRow(ctx context.Context, t db.Table, key []db.KeyValue, target db.Field, value *string) error {
	where := make([]string, len(key))
	args := []any{value} // pgx sends a nil *string as NULL
	for i, k := range key {
		args = append(args, k.Value)
		where[i] = fmt.Sprintf("%s = $%d", p.QuoteIdentifier(k.Field.Name), len(args))
	}
	query := fmt.Sprintf("UPDATE %s SET %s = $1 WHERE %s",
		p.QuoteTable(t), p.QuoteIdentifier(target.Name), strings.Join(where, " AND "))

	tag, err := p.pool.Exec(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("update row: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return db.ErrRowNotFound
	}
	return nil
}

// collect reads every row into column names and value maps, then closes rows.
func collect(rows pgx.Rows) ([]string, []map[string]any, error) {
	res, err := collectCapped(rows, 0, nil)
	return res.Columns, res.Rows, err
}

// collectCapped reads at most maxRows rows (0: all), noting whether more existed.
func collectCapped(rows pgx.Rows, maxRows int, stop context.CancelFunc) (db.QueryResult, error) {
	defer rows.Close()
	fields := rows.FieldDescriptions()
	columns := make([]string, len(fields))
	for i, f := range fields {
		columns[i] = string(f.Name)
	}

	result := make([]map[string]any, 0)
	truncated := false
	for rows.Next() {
		if maxRows > 0 && len(result) == maxRows {
			truncated = true
			if stop != nil {
				stop() // abandon the rest instead of reading it
			}
			break
		}
		values, err := rows.Values()
		if err != nil {
			return db.QueryResult{}, fmt.Errorf("scan row: %w", err)
		}
		row := make(map[string]any, len(columns))
		for i, col := range columns {
			row[col] = normalizeValue(values[i], fields[i].DataTypeOID)
		}
		result = append(result, row)
	}
	rows.Close()
	if err := rows.Err(); err != nil && !truncated {
		return db.QueryResult{}, err
	}
	return db.QueryResult{Columns: columns, Rows: result, Truncated: truncated}, nil
}

func normalizeValue(v any, oid uint32) any {
	switch x := v.(type) {
	case [16]byte:
		return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x", x[0:4], x[4:6], x[6:8], x[8:10], x[10:16])
	case time.Time:
		switch oid {
		case pgtype.DateOID:
			return db.Date(x)
		case pgtype.TimestampOID:
			return db.LocalTime(x)
		}
		return db.Instant(x)
	case pgtype.Numeric:
		return numericText(x) // exact digits, never a float
	case driver.Valuer: // other pgtype values (time, interval, ...) in their text form
		if dv, err := x.Value(); err == nil {
			return db.WireValue(dv)
		}
	}
	return db.WireValue(v)
}

func numericText(n pgtype.Numeric) any {
	v, err := n.Value()
	if err != nil || v == nil {
		return nil
	}
	return v
}
