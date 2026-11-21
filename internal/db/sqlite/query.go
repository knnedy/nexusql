package sqlite

import (
	"context"

	"github.com/knnedy/nexusql/internal/db"
	"github.com/knnedy/nexusql/internal/sqlscan"
)

func (p *provider) Syntax() sqlscan.Syntax { return sqlscan.SQLite }

func (p *provider) ExecuteScript(ctx context.Context, stmts []sqlscan.Statement, opts db.ScriptOptions) (db.QueryResult, error) {
	return db.RunScript(ctx, db.SQLSession{
		Pool:        p.conn,
		Scan:        scanRowsCapped,
		ReadOnlyOn:  "PRAGMA query_only = ON",
		ReadOnlyOff: "PRAGMA query_only = OFF",
		Keep:        p.inMemory,
	}, stmts, opts)
}
