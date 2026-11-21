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

// savepoint runs fn in a nested transaction, so a rejected row leaves the seed usable.
func (s *seedTx) savepoint(ctx context.Context, fn func(pgx.Tx) error) error {
	sp, err := s.tx.Begin(ctx)
	if err != nil {
		return err
	}
	if err := fn(sp); err != nil {
		_ = sp.Rollback(ctx)
		return err
	}
	return sp.Commit(ctx)
}

func (s *seedTx) Update(ctx context.Context, t db.Table, key []db.KeyValue, fields []db.Field, values []*string) error {
	var set, where, marks []string
	var args []any
	for i, f := range fields {
		args = append(args, values[i])
		set, marks = append(set, pgx.Identifier{f.Name}.Sanitize()), append(marks, fmt.Sprintf("$%d", len(args)))
	}
	for _, k := range key {
		args = append(args, k.Value)
		where, marks = append(where, pgx.Identifier{k.Field.Name}.Sanitize()), append(marks, fmt.Sprintf("$%d", len(args)))
	}
	return s.savepoint(ctx, func(sp pgx.Tx) error {
		_, err := sp.Exec(ctx, db.UpdateSQL(s.quoteTable(t), set, where, marks), args...)
		return err
	})
}

func (s *seedTx) Insert(ctx context.Context, t db.Table, fields []db.Field, values []*string, auto []db.Field) (out []string, err error) {
	err = s.savepoint(ctx, func(sp pgx.Tx) error {
		out, err = insert(ctx, sp, s.quoteTable(t), fields, values, auto)
		return err
	})
	return out, err
}

func insert(ctx context.Context, sp pgx.Tx, table string, fields []db.Field, values []*string, auto []db.Field) (out []string, err error) {

	cols := make([]string, len(fields))
	marks := make([]string, len(fields))
	args := make([]any, len(fields))
	for i, f := range fields {
		// pgx sends text for any column type; a nil *string is NULL
		cols[i], marks[i], args[i] = pgx.Identifier{f.Name}.Sanitize(), fmt.Sprintf("$%d", i+1), values[i]
	}
	query := db.InsertSQL(table, cols, marks, "DEFAULT VALUES")
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
