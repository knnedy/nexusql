package mysql

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

// InsertReturningPK is only ever called (per db/seed.go's pkNeedsReturning
// path) when the PK column has a DB-side default — i.e. AUTO_INCREMENT,
// the only such default MySQL's schema introspection reports (see
// schema.go's DefaultValue handling). Client-generated PKs (UUID/etc.) go
// through the pkSelfGenerated path instead and never reach this method, so
// LAST_INSERT_ID() is safe here without needing to inspect pkColumn.
//
// LAST_INSERT_ID() is connection/session-scoped, not global, so this is
// safe to call within a transaction on tx even though tx wraps a *sql.Tx
// rather than a dedicated single connection — database/sql's Tx pins all
// statements in it to one underlying connection for its lifetime.
func (s *seedTx) InsertReturningPK(ctx context.Context, sqlStmt string, pkColumn string) (string, error) {
	if _, err := s.tx.ExecContext(ctx, sqlStmt); err != nil {
		return "", fmt.Errorf("insert failed: %w", err)
	}

	var pk int64
	if err := s.tx.QueryRowContext(ctx, "SELECT LAST_INSERT_ID()").Scan(&pk); err != nil {
		return "", fmt.Errorf("read last insert id: %w", err)
	}
	return fmt.Sprintf("%d", pk), nil
}

func (s *seedTx) Commit(ctx context.Context) error {
	return s.tx.Commit()
}

func (s *seedTx) Rollback(ctx context.Context) error {
	return s.tx.Rollback()
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

// EmptyInsertSQL uses MySQL's all-default-row syntax. MySQL has no
// DEFAULT VALUES clause (unlike Postgres/SQLite) — the equivalent is an
// explicit empty column and value list.
func (p *provider) EmptyInsertSQL(t db.Table) string {
	return fmt.Sprintf("INSERT INTO %s () VALUES ()", p.QuoteTable(t))
}
