package sqlite

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
		Format: formatPKValue, EmptyRow: "DEFAULT VALUES", Returning: true,
	}, nil
}

func (p *provider) QuoteIdentifier(name string) string {
	return quoteIdent(name)
}

// QuoteTable ignores t.Schema — SQLite has no schema-qualification concept
// at the connection level the way Postgres does (a "schema" there is
// either the single implicit database or an ATTACHed database, not
// something IntrospectSchema populates for this provider).
func (p *provider) QuoteTable(t db.Table) string {
	return quoteIdent(t.Name)
}

// formatPKValue converts a scanned primary key into the string form needed
// for embedding in later INSERT statements. database/sql with
// modernc.org/sqlite returns int64 for INTEGER PRIMARY KEY columns (the
// common case) and []byte for TEXT-affinity primary keys (e.g. a
// self-assigned UUID string PK) — []byte is converted directly to string
// rather than hex-formatted, since a text-affinity PK is never binary data
// in the way Postgres's uuid column is.
func formatPKValue(pk any) string {
	switch v := pk.(type) {
	case []byte:
		return string(v)
	default:
		return fmt.Sprintf("%v", pk)
	}
}
