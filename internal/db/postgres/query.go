package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/knnedy/nexusql/internal/db"
	"github.com/knnedy/nexusql/internal/sqlscan"
)

func (p *provider) Syntax() sqlscan.Syntax { return sqlscan.Postgres }

func (p *provider) ExecuteScript(ctx context.Context, stmts []sqlscan.Statement, opts db.ScriptOptions) (res db.QueryResult, err error) {
	c, err := p.pool.Acquire(ctx)
	if err != nil {
		return db.QueryResult{}, err
	}
	defer func() {
		if err == nil && !res.Truncated && !opts.ReadOnly && sqlscan.OnlyReads(stmts) {
			c.Release()
			return
		}
		// Closing ends any transaction, setting or temp table the run left.
		cctx, cancel := context.WithTimeout(context.Background(), time.Second)
		defer cancel()
		_ = c.Hijack().Close(cctx)
	}()

	if opts.ReadOnly {
		// The snapshot taken by SELECT locks the mode: SET TRANSACTION READ WRITE
		// is refused after a transaction's first query.
		for _, q := range []string{"BEGIN READ ONLY", "SELECT 1"} {
			if _, err = exec(ctx, c, q); err != nil {
				return db.QueryResult{}, err
			}
		}
	}
	var affected int64
	for i, st := range stmts {
		if opts.ReadOnly && c.Conn().PgConn().TxStatus() != 'T' {
			err = errors.New("the read-only transaction was ended; statements after it did not run")
			return db.QueryResult{IsWrite: sqlscan.AnyWrite(stmts)}, db.InStatement(err, i, len(stmts))
		}
		if i == len(stmts)-1 && st.Rows {
			res, err = queryCapped(ctx, c, st.Text, opts.MaxRows)
		} else {
			res = db.QueryResult{}
			var tag pgconn.CommandTag
			if tag, err = exec(ctx, c, st.Text); err == nil && st.Write {
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

// exec runs one statement over the extended protocol, which refuses a second
// statement in the same message; pgx's Exec would use the simple protocol.
func exec(ctx context.Context, c *pgxpool.Conn, text string) (pgconn.CommandTag, error) {
	rows, err := c.Query(ctx, text)
	if err != nil {
		return pgconn.CommandTag{}, err
	}
	rows.Close()
	return rows.CommandTag(), rows.Err()
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
