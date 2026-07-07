package postgres

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/knnedy/nexusql/internal/db"
)

func (p *provider) FetchRows(ctx context.Context, tableName string, limit, offset int, sortCol string, sortDir db.SortDir, search string) ([]string, []map[string]any, int64, error) {
	searchCols, err := p.getTextColumns(ctx, tableName)
	if err != nil {
		return nil, nil, 0, fmt.Errorf("get text columns: %w", err)
	}

	whereClause := ""
	searchArgs := []any{}

	if search != "" && len(searchCols) > 0 {
		conditions := make([]string, len(searchCols))
		for i, col := range searchCols {
			conditions[i] = fmt.Sprintf("%s::text ILIKE $%d", pgx.Identifier{col}.Sanitize(), i+1)
			searchArgs = append(searchArgs, "%"+search+"%")
		}
		whereClause = " WHERE " + strings.Join(conditions, " OR ")
	}

	var total int64
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM %q%s", tableName, whereClause)
	if err := p.pool.QueryRow(ctx, countQuery, searchArgs...).Scan(&total); err != nil {
		return nil, nil, 0, fmt.Errorf("count rows: %w", err)
	}

	query := fmt.Sprintf("SELECT * FROM %q%s", tableName, whereClause)

	if sortCol != "" {
		dir := "ASC"
		if sortDir == db.SortDesc {
			dir = "DESC"
		}
		query += fmt.Sprintf(" ORDER BY %s %s", pgx.Identifier{sortCol}.Sanitize(), dir)
	}

	nextParam := len(searchArgs) + 1
	query += fmt.Sprintf(" LIMIT $%d OFFSET $%d", nextParam, nextParam+1)

	dataArgs := append(searchArgs, limit, offset)

	rows, err := p.pool.Query(ctx, query, dataArgs...)
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

func (p *provider) getTextColumns(ctx context.Context, tableName string) ([]string, error) {
	rows, err := p.pool.Query(ctx,
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
		"SELECT * FROM %s WHERE %s = $1 LIMIT 100",
		pgx.Identifier{tableName}.Sanitize(),
		pgx.Identifier{field}.Sanitize(),
	)

	rows, err := p.pool.Query(ctx, query, value)
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

func (p *provider) getTableColumns(ctx context.Context, tableName string) ([]string, error) {
	rows, err := p.pool.Query(ctx,
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
		"UPDATE %s SET %s = $1 WHERE %s = $2",
		pgx.Identifier{tableName}.Sanitize(),
		pgx.Identifier{targetField}.Sanitize(),
		pgx.Identifier{pkField}.Sanitize(),
	)

	tag, err := p.pool.Exec(ctx, query, newValue, pkValue)
	if err != nil {
		return fmt.Errorf("update row: %w", err)
	}

	if tag.RowsAffected() == 0 {
		return fmt.Errorf("no row found with %s = %s", pkField, pkValue)
	}

	return nil
}
