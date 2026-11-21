package sqlite

import (
	"context"

	"github.com/knnedy/nexusql/internal/db"
	"github.com/knnedy/nexusql/internal/sqlscan"
)

func (p *provider) Syntax() sqlscan.Syntax { return sqlscan.SQLite }

func (p *provider) ExecuteScript(ctx context.Context, stmts []sqlscan.Statement, maxRows int) (db.QueryResult, error) {
	return db.RunScript(ctx, p.conn, stmts, maxRows, scanRowsCapped, p.inMemory)
}
