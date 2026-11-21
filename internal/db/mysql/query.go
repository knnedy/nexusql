package mysql

import (
	"context"

	"github.com/knnedy/nexusql/internal/db"
	"github.com/knnedy/nexusql/internal/sqlscan"
)

func (p *provider) Syntax() sqlscan.Syntax { return sqlscan.MySQL }

func (p *provider) ExecuteScript(ctx context.Context, stmts []sqlscan.Statement, opts db.ScriptOptions) (db.QueryResult, error) {
	return db.RunScript(ctx, db.SQLSession{
		Pool: p.conn,
		Scan: scanRowsCapped,
		// Session-wide, so BEGIN and DDL's implicit commits stay read-only too.
		ReadOnlyOn: "SET SESSION TRANSACTION READ ONLY",
	}, stmts, opts)
}
