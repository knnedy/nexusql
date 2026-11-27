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

// where is this dialect's WHERE builder for rows of t.
func (p *provider) where(t db.Table) db.Where {
	return db.Where{
		Quote:      p.QuoteIdentifier,
		Param:      func(n int) string { return fmt.Sprintf("$%d", n) },
		ILike:      func(col, param string) string { return col + "::text ILIKE " + param },
		Arg:        func(_ db.Field, v string) any { return v },
		Searchable: searchable,
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
	rows, err := p.pool.Query(ctx, query, append(args, req.Limit, offset)...)
	if err != nil {
		return nil, nil, fmt.Errorf("query rows: %w", err)
	}
	return collect(rows)
}

func (p *provider) CountRows(ctx context.Context, req db.RowsRequest) (int64, error) {
	req.After = nil // the count covers every page
	clause, args, err := p.where(req.Table).Clause(req)
	if err != nil {
		return 0, err
	}
	var total int64
	if err := p.pool.QueryRow(ctx, "SELECT COUNT(*) FROM "+p.QuoteTable(req.Table)+clause, args...).Scan(&total); err != nil {
		return 0, fmt.Errorf("count rows: %w", err)
	}
	return total, nil
}

// searchable reports whether search matches against f (text-like columns).
func searchable(f db.Field) bool {
	switch f.Type {
	case db.FieldTypeText, db.FieldTypeVarchar, db.FieldTypeChar, db.FieldTypeUUID, "name", "citext":
		return true
	}
	return false
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

// typeNames names built-in types by OID; types it does not know (enums, domains) read "".
var typeNames = pgtype.NewMap()

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
	types := make([]string, len(fields))
	for i, f := range fields {
		if t, ok := typeNames.TypeForOID(f.DataTypeOID); ok {
			types[i] = t.Name
		}
	}
	return db.QueryResult{Columns: columns, ColumnTypes: types, Rows: result, Truncated: truncated}, nil
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
