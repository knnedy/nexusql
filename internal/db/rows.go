package db

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
)

type SortDir string

const (
	SortAsc  SortDir = "asc"
	SortDesc SortDir = "desc"
)

func FetchRows(ctx context.Context, conn *Connection, tableName string, limit, offset int, sortCol string, sortDir SortDir) ([]string, []map[string]any, int64, error) {
	var total int64
	if err := conn.Pool.QueryRow(ctx, fmt.Sprintf("SELECT COUNT(*) FROM %q", tableName)).Scan(&total); err != nil {
		return nil, nil, 0, fmt.Errorf("count rows: %w", err)
	}

	query := fmt.Sprintf("SELECT * FROM %q", tableName)

	if sortCol != "" {
		dir := "ASC"
		if sortDir == SortDesc {
			dir = "DESC"
		}
		query += fmt.Sprintf(" ORDER BY %s %s", pgx.Identifier{sortCol}.Sanitize(), dir)
	}

	query += " LIMIT $1 OFFSET $2"

	rows, err := conn.Pool.Query(ctx, query, limit, offset)
	if err != nil {
		return nil, nil, 0, fmt.Errorf("query rows: %w", err)
	}
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
			return nil, nil, 0, fmt.Errorf("scan row: %w", err)
		}
		row := make(map[string]any, len(columns))
		for i, col := range columns {
			row[col] = normalizeValue(values[i])
		}
		result = append(result, row)
	}

	if err := rows.Err(); err != nil {
		return nil, nil, 0, err
	}

	return columns, result, total, nil
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

func GetTableColumns(ctx context.Context, conn *Connection, tableName string) ([]string, error) {
	rows, err := conn.Pool.Query(ctx,
		`SELECT column_name FROM information_schema.columns
		 WHERE table_schema = 'public' AND table_name = $1
		 ORDER BY ordinal_position`,
		tableName,
	)
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
