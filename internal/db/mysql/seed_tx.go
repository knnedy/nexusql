package mysql

import (
	"context"
	"fmt"

	"github.com/knnedy/nexusql/internal/db"
)

func (p *provider) BeginSeedTx(ctx context.Context) (db.SeedTx, error) {
	tx, err := p.conn.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to begin seed transaction: %w", err)
	}
	return &db.SQLSeedTx{
		Tx: tx, QuoteTable: p.QuoteTable, Quote: quoteIdent, Arg: editArg,
		EmptyRow: "() VALUES ()", // no RETURNING: LAST_INSERT_ID reports the auto value
	}, nil
}

func (p *provider) QuoteIdentifier(name string) string {
	return quoteIdent(name)
}

// QuoteTable ignores t.Schema — like SQLite, MySQL has no separate
// schema-qualification concept at the connection level the way Postgres
// does (database and schema are the same thing; see resolveSchema in
// schema.go).
func (p *provider) QuoteTable(t db.Table) string {
	return quoteIdent(t.Name)
}
