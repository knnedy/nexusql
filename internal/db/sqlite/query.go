package sqlite

import (
	"context"
	"fmt"

	"github.com/knnedy/nexusql/internal/db"
)

func (p *provider) ExecuteQuery(ctx context.Context, sql string, maxRows int) (db.QueryResult, error) {
	if db.IsSelectQuery(sql) {
		rows, err := p.conn.QueryContext(ctx, sql)
		if err != nil {
			return db.QueryResult{}, fmt.Errorf("query failed: %w", err)
		}
		defer rows.Close()
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
