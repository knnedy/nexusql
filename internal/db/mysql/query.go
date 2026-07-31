package mysql

import (
	"context"
	"fmt"
	"strings"

	"github.com/knnedy/nexusql/internal/db"
)

func (p *provider) ExecuteQuery(ctx context.Context, sql string) ([]string, []map[string]any, int64, bool, error) {
	trimmed := strings.TrimSpace(sql)
	trimmed = strings.TrimSuffix(trimmed, ";")

	if db.IsSelectQuery(trimmed) {
		if !db.HasExplicitLimit(trimmed) {
			trimmed = trimmed + " LIMIT 500"
		}

		rows, err := p.conn.QueryContext(ctx, trimmed)
		if err != nil {
			return nil, nil, 0, false, fmt.Errorf("query failed: %w", err)
		}
		defer rows.Close()

		columns, result, err := scanRows(rows)
		if err != nil {
			return nil, nil, 0, false, err
		}

		return columns, result, 0, false, nil
	}

	result, err := p.conn.ExecContext(ctx, trimmed)
	if err != nil {
		return nil, nil, 0, true, fmt.Errorf("execute failed: %w", err)
	}

	affected, err := result.RowsAffected()
	if err != nil {
		return nil, nil, 0, true, fmt.Errorf("check rows affected: %w", err)
	}

	return nil, nil, affected, true, nil
}
