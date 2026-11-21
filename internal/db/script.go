package db

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"fmt"

	"github.com/knnedy/nexusql/internal/sqlscan"
)

// InStatement prefixes err with its statement's position in a multi-statement run.
func InStatement(err error, i, n int) error {
	if n == 1 {
		return err
	}
	return fmt.Errorf("statement %d of %d: %w", i+1, n, err)
}

// RunScript is ExecuteScript for database/sql drivers; scan reads one result set,
// stopping at maxRows. keepSession reuses the connection (an in-memory database).
func RunScript(ctx context.Context, pool *sql.DB, stmts []sqlscan.Statement, maxRows int,
	scan func(*sql.Rows, int) (QueryResult, error), keepSession bool) (res QueryResult, err error) {
	c, err := pool.Conn(ctx)
	if err != nil {
		return QueryResult{}, fmt.Errorf("acquire connection: %w", err)
	}
	defer func() {
		switch {
		case err == nil && !res.Truncated && sqlscan.OnlyReads(stmts):
		case keepSession: // closing would drop the database; end the transaction instead
			_, _ = c.ExecContext(context.Background(), "ROLLBACK")
		default: // closing ends any transaction, setting or temp table the run left
			_ = c.Raw(func(any) error { return driver.ErrBadConn })
		}
		_ = c.Close()
	}()

	var affected int64
	for i, st := range stmts {
		if i == len(stmts)-1 && st.Rows {
			res, err = queryCapped(ctx, c, st.Text, maxRows, scan)
		} else {
			res, err = QueryResult{}, nil
			var r sql.Result
			if r, err = c.ExecContext(ctx, st.Text); err == nil && st.Write {
				res.RowsAffected, err = r.RowsAffected()
			}
		}
		if err != nil {
			return QueryResult{IsWrite: sqlscan.AnyWrite(stmts)}, InStatement(err, i, len(stmts))
		}
		affected += res.RowsAffected
	}
	res.RowsAffected, res.IsWrite = affected, sqlscan.AnyWrite(stmts)
	return res, nil
}

func queryCapped(ctx context.Context, c *sql.Conn, text string, maxRows int,
	scan func(*sql.Rows, int) (QueryResult, error)) (QueryResult, error) {
	qctx, cancel := context.WithCancel(ctx)
	defer cancel()
	rows, err := c.QueryContext(qctx, text)
	if err != nil {
		return QueryResult{}, err
	}
	res, err := scan(rows, maxRows)
	if res.Truncated {
		cancel() // before Close: MySQL would otherwise read every remaining row
	}
	rows.Close()
	return res, err
}
