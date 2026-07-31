package sqlite

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/knnedy/nexusql/internal/db"
)

type seedTx struct {
	tx *sql.Tx
}

func (p *provider) BeginSeedTx(ctx context.Context) (db.SeedTx, error) {
	tx, err := p.conn.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to begin seed transaction: %w", err)
	}
	return &seedTx{tx: tx}, nil
}

func (s *seedTx) Exec(ctx context.Context, sqlStmt string) error {
	if _, err := s.tx.ExecContext(ctx, sqlStmt); err != nil {
		return fmt.Errorf("exec failed: %w", err)
	}
	return nil
}

// InsertReturningPK relies on SQLite's RETURNING clause, supported since
// SQLite 3.35 (2021). modernc.org/sqlite bundles a current SQLite version,
// so this is available without any version gating.
func (s *seedTx) InsertReturningPK(ctx context.Context, sqlStmt string, pkColumn string) (string, error) {
	full := fmt.Sprintf("%s RETURNING %s", sqlStmt, quoteIdent(pkColumn))

	var pk any
	if err := s.tx.QueryRowContext(ctx, full).Scan(&pk); err != nil {
		return "", fmt.Errorf("insert failed: %w", err)
	}
	return formatPKValue(pk), nil
}

func (s *seedTx) Commit(ctx context.Context) error {
	return s.tx.Commit()
}

func (s *seedTx) Rollback(ctx context.Context) error {
	return s.tx.Rollback()
}

// QuoteIdentifier, QuoteTable, and EmptyInsertSQL were previously
// free-standing functions in db/seed.go (quoteIdent, quoteTable, and an
// inline "INSERT INTO t DEFAULT VALUES" literal). Moved onto the provider
// per the shared Provider interface. quoteIdent itself (used elsewhere in
// this package, e.g. schema.go/rows.go) is unchanged — QuoteIdentifier just
// delegates to it.

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

func (p *provider) EmptyInsertSQL(t db.Table) string {
	return fmt.Sprintf("INSERT INTO %s DEFAULT VALUES", p.QuoteTable(t))
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
