package postgres

import (
	"context"
	"fmt"

	"github.com/knnedy/nexusql/internal/db"
)

func (p *provider) ExecuteQuery(ctx context.Context, sql string, maxRows int) (db.QueryResult, error) {
	if db.IsSelectQuery(sql) {
		// Cancel on truncation: pgx would otherwise read every row left after the cap.
		qctx, cancel := context.WithCancel(ctx)
		defer cancel()
		rows, err := p.pool.Query(qctx, sql)
		if err != nil {
			return db.QueryResult{}, fmt.Errorf("query failed: %w", err)
		}
		return collectCapped(rows, maxRows, cancel)
	}

	tag, err := p.pool.Exec(ctx, sql)
	if err != nil {
		return db.QueryResult{IsWrite: true}, fmt.Errorf("execute failed: %w", err)
	}
	return db.QueryResult{RowsAffected: tag.RowsAffected(), IsWrite: true}, nil
}
