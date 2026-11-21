package db

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
)

const seedSavepoint = "nexusql_seed_row"

// InsertSQL builds an INSERT of cols (already quoted) with placeholders;
// emptyRow is the dialect's all-default form ("DEFAULT VALUES" or "() VALUES ()").
func InsertSQL(table string, cols, placeholders []string, emptyRow string) string {
	if len(cols) == 0 {
		return fmt.Sprintf("INSERT INTO %s %s", table, emptyRow)
	}
	return fmt.Sprintf("INSERT INTO %s (%s) VALUES (%s)",
		table, strings.Join(cols, ", "), strings.Join(placeholders, ", "))
}

// SQLSeedTx is SeedTx for database/sql drivers.
type SQLSeedTx struct {
	Tx         *sql.Tx
	QuoteTable func(Table) string
	Quote      func(string) string
	Arg        func(Field, *string) any // converts text like a cell edit
	Format     func(any) string         // turns a returned value back into text
	EmptyRow   string
	Returning  bool // RETURNING exists; otherwise LAST_INSERT_ID gives one auto value
}

// UpdateSQL builds an UPDATE setting each of set to its placeholder (marks[i])
// on the row where each of where equals its placeholder (marks[len(set)+i]).
func UpdateSQL(table string, set, where, marks []string) string {
	sets := make([]string, len(set))
	for i, c := range set {
		sets[i] = c + " = " + marks[i]
	}
	conds := make([]string, len(where))
	for i, c := range where {
		conds[i] = c + " = " + marks[len(set)+i]
	}
	return fmt.Sprintf("UPDATE %s SET %s WHERE %s", table, strings.Join(sets, ", "), strings.Join(conds, " AND "))
}

// savepoint runs fn so that its failure undoes only its own work.
func (s *SQLSeedTx) savepoint(ctx context.Context, fn func() error) error {
	if _, err := s.Tx.ExecContext(ctx, "SAVEPOINT "+seedSavepoint); err != nil {
		return err
	}
	if err := fn(); err != nil {
		_, _ = s.Tx.ExecContext(ctx, "ROLLBACK TO SAVEPOINT "+seedSavepoint)
		return err
	}
	_, err := s.Tx.ExecContext(ctx, "RELEASE SAVEPOINT "+seedSavepoint)
	return err
}

func (s *SQLSeedTx) Update(ctx context.Context, t Table, key []KeyValue, fields []Field, values []*string) error {
	var set, where, marks []string
	var args []any
	for i, f := range fields {
		set, marks, args = append(set, s.Quote(f.Name)), append(marks, "?"), append(args, s.Arg(f, values[i]))
	}
	for _, k := range key {
		v := k.Value
		where, marks, args = append(where, s.Quote(k.Field.Name)), append(marks, "?"), append(args, s.Arg(k.Field, &v))
	}
	return s.savepoint(ctx, func() error {
		_, err := s.Tx.ExecContext(ctx, UpdateSQL(s.QuoteTable(t), set, where, marks), args...)
		return err
	})
}

func (s *SQLSeedTx) Insert(ctx context.Context, t Table, fields []Field, values []*string, auto []Field) (out []string, err error) {
	err = s.savepoint(ctx, func() error {
		out, err = s.insert(ctx, t, fields, values, auto)
		return err
	})
	return out, err
}

func (s *SQLSeedTx) insert(ctx context.Context, t Table, fields []Field, values []*string, auto []Field) (out []string, err error) {
	cols := make([]string, len(fields))
	marks := make([]string, len(fields))
	args := make([]any, len(fields))
	for i, f := range fields {
		cols[i], marks[i], args[i] = s.Quote(f.Name), "?", s.Arg(f, values[i])
	}
	query := InsertSQL(s.QuoteTable(t), cols, marks, s.EmptyRow)

	switch {
	case len(auto) == 0:
		_, err = s.Tx.ExecContext(ctx, query, args...)
		return nil, err
	case s.Returning:
		names := make([]string, len(auto))
		for i, f := range auto {
			names[i] = s.Quote(f.Name)
		}
		got := make([]any, len(auto))
		ptrs := make([]any, len(auto))
		for i := range got {
			ptrs[i] = &got[i]
		}
		if err = s.Tx.QueryRowContext(ctx, query+" RETURNING "+strings.Join(names, ", "), args...).Scan(ptrs...); err != nil {
			return nil, err
		}
		out = make([]string, len(got))
		for i, v := range got {
			out[i] = s.Format(v)
		}
		return out, nil
	case len(auto) == 1:
		var res sql.Result
		if res, err = s.Tx.ExecContext(ctx, query, args...); err != nil {
			return nil, err
		}
		id, err := res.LastInsertId()
		if err != nil {
			return nil, err
		}
		return []string{fmt.Sprint(id)}, nil
	default:
		return nil, fmt.Errorf("%s: cannot read back %d generated columns", t.Name, len(auto))
	}
}

func (s *SQLSeedTx) Commit(context.Context) error   { return s.Tx.Commit() }
func (s *SQLSeedTx) Rollback(context.Context) error { return s.Tx.Rollback() }
