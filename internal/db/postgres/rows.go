package postgres

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/knnedy/nexusql/internal/db"
)

func (p *provider) FetchRows(ctx context.Context, req db.RowsRequest) ([]string, []map[string]any, int64, error) {
	table := p.QuoteTable(req.Table)

	whereClause := ""
	var searchArgs []any
	if req.Search != "" {
		var conditions []string
		for _, f := range req.Table.Fields {
			if searchable(f) {
				searchArgs = append(searchArgs, "%"+req.Search+"%")
				conditions = append(conditions, fmt.Sprintf("%s::text ILIKE $%d", p.QuoteIdentifier(f.Name), len(searchArgs)))
			}
		}
		if len(conditions) > 0 {
			whereClause = " WHERE " + strings.Join(conditions, " OR ")
		}
	}

	var total int64
	if err := p.pool.QueryRow(ctx, "SELECT COUNT(*) FROM "+table+whereClause, searchArgs...).Scan(&total); err != nil {
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
	query += fmt.Sprintf(" LIMIT $%d OFFSET $%d", len(searchArgs)+1, len(searchArgs)+2)

	dataArgs := append(append([]any{}, searchArgs...), req.Limit, req.Offset)
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

func (p *provider) UpdateRow(ctx context.Context, t db.Table, pk db.Field, pkValue string, target db.Field, newValue string) error {
	query := fmt.Sprintf("UPDATE %s SET %s = $1 WHERE %s = $2",
		p.QuoteTable(t), p.QuoteIdentifier(target.Name), p.QuoteIdentifier(pk.Name))

	tag, err := p.pool.Exec(ctx, query, newValue, pkValue)
	if err != nil {
		return fmt.Errorf("update row: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("no row found with %s = %s", pk.Name, pkValue)
	}
	return nil
}

// collect reads every row into column names and value maps, then closes rows.
func collect(rows pgx.Rows) ([]string, []map[string]any, error) {
	defer rows.Close()
	fields := rows.FieldDescriptions()
	columns := make([]string, len(fields))
	for i, f := range fields {
		columns[i] = string(f.Name)
	}

	result := make([]map[string]any, 0)
	for rows.Next() {
		values, err := rows.Values()
		if err != nil {
			return nil, nil, fmt.Errorf("scan row: %w", err)
		}
		row := make(map[string]any, len(columns))
		for i, col := range columns {
			row[col] = normalizeValue(values[i])
		}
		result = append(result, row)
	}
	if err := rows.Err(); err != nil {
		return nil, nil, err
	}
	return columns, result, nil
}

func normalizeValue(v any) any {
	switch val := v.(type) {
	case [16]byte:
		return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x",
			val[0:4], val[4:6], val[6:8], val[8:10], val[10:16])
	default:
		return v
	}
}
