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
