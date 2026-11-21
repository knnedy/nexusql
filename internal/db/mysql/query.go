package mysql

import (
	"context"
	"fmt"

	"github.com/knnedy/nexusql/internal/db"
)

func (p *provider) ExecuteQuery(ctx context.Context, sql string, maxRows int) (db.QueryResult, error) {
	if db.IsSelectQuery(sql) {
		// Cancel before Close: the driver would otherwise read every row
		// left over after the cap.
		qctx, cancel := context.WithCancel(ctx)
		rows, err := p.conn.QueryContext(qctx, sql)
		if err != nil {
			cancel()
			return db.QueryResult{}, fmt.Errorf("query failed: %w", err)
		}
		defer rows.Close()
		defer cancel()
		res, err := scanRowsCapped(rows, maxRows)
		if err != nil {
			return db.QueryResult{}, err
		}
		return res, nil
	}

	result, err := p.conn.ExecContext(ctx, sql)
	if err != nil {
		return db.QueryResult{IsWrite: true}, fmt.Errorf("execute failed: %w", err)
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return db.QueryResult{IsWrite: true}, fmt.Errorf("check rows affected: %w", err)
	}
	return db.QueryResult{RowsAffected: affected, IsWrite: true}, nil
}
