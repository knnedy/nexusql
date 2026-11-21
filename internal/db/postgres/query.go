package postgres

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/knnedy/nexusql/internal/db"
	"github.com/knnedy/nexusql/internal/sqlscan"
)

func (p *provider) Syntax() sqlscan.Syntax { return sqlscan.Postgres }

func (p *provider) ExecuteScript(ctx context.Context, stmts []sqlscan.Statement, maxRows int) (res db.QueryResult, err error) {
	c, err := p.pool.Acquire(ctx)
	if err != nil {
		return db.QueryResult{}, err
	}
	defer func() {
		if err == nil && !res.Truncated && sqlscan.OnlyReads(stmts) {
			c.Release()
			return
		}
		// Closing ends any transaction, setting or temp table the run left.
		cctx, cancel := context.WithTimeout(context.Background(), time.Second)
		defer cancel()
		_ = c.Hijack().Close(cctx)
	}()

	var affected int64
	for i, st := range stmts {
		if i == len(stmts)-1 && st.Rows {
			res, err = queryCapped(ctx, c, st.Text, maxRows)
		} else {
			res, err = db.QueryResult{}, nil
			tag, execErr := c.Exec(ctx, st.Text)
			if err = execErr; err == nil && st.Write {
				res.RowsAffected = tag.RowsAffected()
			}
		}
		if err != nil {
			return db.QueryResult{IsWrite: sqlscan.AnyWrite(stmts)}, db.InStatement(err, i, len(stmts))
		}
		affected += res.RowsAffected
	}
	res.RowsAffected, res.IsWrite = affected, sqlscan.AnyWrite(stmts)
	return res, nil
}

func queryCapped(ctx context.Context, c *pgxpool.Conn, text string, maxRows int) (db.QueryResult, error) {
	// Cancel on truncation: pgx would otherwise read every row left after the cap.
	qctx, cancel := context.WithCancel(ctx)
	defer cancel()
	rows, err := c.Query(qctx, text)
	if err != nil {
		return db.QueryResult{}, err
	}
	return collectCapped(rows, maxRows, cancel)
}
