package sqlite

import (
	"context"
	"errors"

	"github.com/knnedy/nexusql/internal/db"
	"github.com/knnedy/nexusql/internal/sqlscan"
)

func (p *provider) Syntax() sqlscan.Syntax { return sqlscan.SQLite }

func (p *provider) ExecuteScript(ctx context.Context, stmts []sqlscan.Statement, opts db.ScriptOptions) (db.QueryResult, error) {
	if p.confined {
		for i, s := range stmts {
			if s.Starts("ATTACH") || s.Starts("VACUUM") && s.Has("INTO") {
				return db.QueryResult{}, db.InStatement(errors.New("ATTACH and VACUUM INTO are disabled while file access is confined"), i, len(stmts))
			}
		}
	}
	return db.RunScript(ctx, db.SQLSession{
		Pool:        p.conn,
		Scan:        scanRowsCapped,
		ReadOnlyOn:  "PRAGMA query_only = ON",
		ReadOnlyOff: "PRAGMA query_only = OFF",
		Reset:       foreignKeys,
		Keep:        p.inMemory,
	}, stmts, opts)
}
