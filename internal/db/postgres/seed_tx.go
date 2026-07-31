package postgres

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/knnedy/nexusql/internal/db"
)

type seedTx struct {
	tx pgx.Tx
}

func (p *provider) BeginSeedTx(ctx context.Context) (db.SeedTx, error) {
	tx, err := p.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to begin seed transaction: %w", err)
	}
	return &seedTx{tx: tx}, nil
}

func (s *seedTx) Exec(ctx context.Context, sqlStmt string) error {
	if _, err := s.tx.Exec(ctx, sqlStmt); err != nil {
		return fmt.Errorf("exec failed: %w", err)
	}
	return nil
}

func (s *seedTx) InsertReturningPK(ctx context.Context, sqlStmt string, pkColumn string) (string, error) {
	full := fmt.Sprintf("%s RETURNING %s", sqlStmt, pgx.Identifier{pkColumn}.Sanitize())

	var pk any
	if err := s.tx.QueryRow(ctx, full).Scan(&pk); err != nil {
		return "", fmt.Errorf("insert failed: %w", err)
	}
	return formatPKValue(pk), nil
}

func (s *seedTx) Commit(ctx context.Context) error {
	return s.tx.Commit(ctx)
}

func (s *seedTx) Rollback(ctx context.Context) error {
	return s.tx.Rollback(ctx)
}

// QuoteIdentifier, QuoteTable, and EmptyInsertSQL were previously
// free-standing functions in db/seed.go (quoteIdent, quoteTable, and an
// inline "INSERT INTO t DEFAULT VALUES" literal). Moved onto the provider
// per the shared Provider interface, unchanged in behavior for Postgres.

func (p *provider) QuoteIdentifier(name string) string {
	return pgx.Identifier{name}.Sanitize()
}

func (p *provider) QuoteTable(t db.Table) string {
	if t.Schema == "" {
		return p.QuoteIdentifier(t.Name)
	}
	return pgx.Identifier{t.Schema, t.Name}.Sanitize()
}

func (p *provider) EmptyInsertSQL(t db.Table) string {
	return fmt.Sprintf("INSERT INTO %s DEFAULT VALUES", p.QuoteTable(t))
}

// formatPKValue converts a scanned primary key into the string form needed
// for embedding in later INSERT statements. pgx decodes uuid columns as
// [16]byte rather than a string when scanned into `any`, so that case needs
// explicit hex formatting; everything else (int64, string, etc.) is safe to
// format with %v.
func formatPKValue(pk any) string {
	switch v := pk.(type) {
	case [16]byte:
		return formatUUIDBytes(v[:])
	case []byte:
		if len(v) == 16 {
			return formatUUIDBytes(v)
		}
		return string(v)
	default:
		return fmt.Sprintf("%v", pk)
	}
}

func formatUUIDBytes(b []byte) string {
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}
