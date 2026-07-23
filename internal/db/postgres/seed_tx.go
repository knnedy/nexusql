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

func (s *seedTx) InsertReturningPK(ctx context.Context, sqlStmt string, pkColumn string) (string, error) {
	full := fmt.Sprintf("%s RETURNING %s", sqlStmt, pgx.Identifier{pkColumn}.Sanitize())

	var pk any
	if err := s.tx.QueryRow(ctx, full).Scan(&pk); err != nil {
		return "", fmt.Errorf("insert failed: %w", err)
	}
	return fmt.Sprintf("%v", pk), nil
}

func (s *seedTx) Commit(ctx context.Context) error {
	return s.tx.Commit(ctx)
}

func (s *seedTx) Rollback(ctx context.Context) error {
	return s.tx.Rollback(ctx)
}
