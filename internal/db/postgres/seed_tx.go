package postgres

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/knnedy/nexusql/internal/db"
)

type seedTx struct {
	tx         pgx.Tx
	quoteTable func(db.Table) string
}

func (p *provider) BeginSeedTx(ctx context.Context) (db.SeedTx, error) {
	tx, err := p.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to begin seed transaction: %w", err)
	}
	return &seedTx{tx: tx, quoteTable: p.QuoteTable}, nil
}

func (s *seedTx) Insert(ctx context.Context, t db.Table, fields []db.Field, values []*string, auto []db.Field) (out []string, err error) {
	sp, err := s.tx.Begin(ctx) // a savepoint: a rejected row leaves the seed usable
	if err != nil {
		return nil, err
	}
	defer func() {
		if err != nil {
			_ = sp.Rollback(ctx)
		} else {
			err = sp.Commit(ctx)
		}
	}()

	cols := make([]string, len(fields))
	marks := make([]string, len(fields))
	args := make([]any, len(fields))
	for i, f := range fields {
		// pgx sends text for any column type; a nil *string is NULL
		cols[i], marks[i], args[i] = pgx.Identifier{f.Name}.Sanitize(), fmt.Sprintf("$%d", i+1), values[i]
	}
	query := db.InsertSQL(s.quoteTable(t), cols, marks, "DEFAULT VALUES")
	if len(auto) == 0 {
		_, err = sp.Exec(ctx, query, args...)
		return nil, err
	}
	names := make([]string, len(auto))
	for i, f := range auto {
		names[i] = pgx.Identifier{f.Name}.Sanitize()
	}
	got := make([]any, len(auto))
	ptrs := make([]any, len(auto))
	for i := range got {
		ptrs[i] = &got[i]
	}
	if err = sp.QueryRow(ctx, query+" RETURNING "+strings.Join(names, ", "), args...).Scan(ptrs...); err != nil {
		return nil, err
	}
	out = make([]string, len(got))
	for i, v := range got {
		out[i] = formatPKValue(v)
	}
	return out, nil
}

func (s *seedTx) Commit(ctx context.Context) error   { return s.tx.Commit(ctx) }
func (s *seedTx) Rollback(ctx context.Context) error { return s.tx.Rollback(ctx) }

func (p *provider) QuoteIdentifier(name string) string {
	return pgx.Identifier{name}.Sanitize()
}

func (p *provider) QuoteTable(t db.Table) string {
	if t.Schema == "" {
		return p.QuoteIdentifier(t.Name)
	}
	return pgx.Identifier{t.Schema, t.Name}.Sanitize()
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
