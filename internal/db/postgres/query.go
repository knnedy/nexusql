package postgres

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

		rows, err := p.pool.Query(ctx, trimmed)
		if err != nil {
			return nil, nil, 0, false, fmt.Errorf("query failed: %w", err)
		}
		columns, result, err := collect(rows)
		if err != nil {
			return nil, nil, 0, false, err
		}
		return columns, result, 0, false, nil
	}

	tag, err := p.pool.Exec(ctx, trimmed)
	if err != nil {
		return nil, nil, 0, true, fmt.Errorf("execute failed: %w", err)
	}

	return nil, nil, tag.RowsAffected(), true, nil
}
