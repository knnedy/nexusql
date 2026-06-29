package db

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
)

type SortDir string

const (
	SortAsc  SortDir = "asc"
	SortDesc SortDir = "desc"
)

func FetchRows(ctx context.Context, conn *Connection, tableName string, limit, offset int, sortCol string, sortDir SortDir, search string) ([]string, []map[string]any, int64, error) {
	searchCols, err := getTextColumns(ctx, conn, tableName)
	if err != nil {
		return nil, nil, 0, fmt.Errorf("get text columns: %w", err)
	}

	whereClause := ""
	args := []any{limit, offset}

	if search != "" && len(searchCols) > 0 {
		conditions := make([]string, len(searchCols))
		for i, col := range searchCols {
			argIdx := len(args) + 1
			conditions[i] = fmt.Sprintf("%s::text ILIKE $%d", pgx.Identifier{col}.Sanitize(), argIdx)
			args = append(args, "%"+search+"%")
		}
		whereClause = " WHERE " + strings.Join(conditions, " OR ")
	}

	var total int64
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM %q%s", tableName, whereClause)
	countArgs := args[2:]
	if err := conn.Pool.QueryRow(ctx, countQuery, countArgs...).Scan(&total); err != nil {
		return nil, nil, 0, fmt.Errorf("count rows: %w", err)
	}

	query := fmt.Sprintf("SELECT * FROM %q%s", tableName, whereClause)

	if sortCol != "" {
		dir := "ASC"
		if sortDir == SortDesc {
			dir = "DESC"
		}
		query += fmt.Sprintf(" ORDER BY %s %s", pgx.Identifier{sortCol}.Sanitize(), dir)
	}

	query += fmt.Sprintf(" LIMIT $1 OFFSET $2")

	rows, err := conn.Pool.Query(ctx, query, args...)
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

func getTextColumns(ctx context.Context, conn *Connection, tableName string) ([]string, error) {
	rows, err := conn.Pool.Query(ctx,
		`SELECT column_name FROM information_schema.columns
		 WHERE table_schema = 'public'
		   AND table_name = $1
		   AND data_type IN (
		     'text', 'character varying', 'character', 'varchar',
		     'uuid', 'name', 'citext'
		   )
		 ORDER BY ordinal_position`,
		tableName,
	)
	if err != nil {
		return nil, fmt.Errorf("get text columns: %w", err)
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

func FetchRowWhere(ctx context.Context, conn *Connection, tableName, field, value string) ([]string, []map[string]any, error) {
	validCols, err := GetTableColumns(ctx, conn, tableName)
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
		"SELECT * FROM %s WHERE %s = $1 LIMIT 100",
		pgx.Identifier{tableName}.Sanitize(),
		pgx.Identifier{field}.Sanitize(),
	)

	rows, err := conn.Pool.Query(ctx, query, value)
	if err != nil {
		return nil, nil, fmt.Errorf("query rows: %w", err)
	}
	defer rows.Close()

	descs := rows.FieldDescriptions()
	columns := make([]string, len(descs))
	for i, f := range descs {
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
