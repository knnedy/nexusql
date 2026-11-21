package studio

import (
	"context"
	"errors"
	"fmt"

	"github.com/knnedy/nexusql/internal/db"
	"github.com/knnedy/nexusql/internal/export"
	"github.com/knnedy/nexusql/internal/seed"
	"github.com/knnedy/nexusql/internal/sqlscan"
)

// Schema introspects the active connection. An empty name means the dialect's
// default schema, which also refreshes the identifier cache.
func (s *Service) Schema(ctx context.Context, schema string) (*db.Schema, error) {
	conn, err := s.conn()
	if err != nil {
		return nil, err
	}
	if schema == "" {
		return s.schemas.get(ctx, conn, true)
	}
	return conn.Impl.IntrospectSchema(ctx, schema)
}

// RowsQuery selects one page of a table.
type RowsQuery struct {
	Table   string
	Limit   int
	Offset  int
	SortCol string
	SortDir db.SortDir
	Search  string
}

// RowsPage is one page of table data.
type RowsPage struct {
	Columns []string
	Rows    []map[string]any
	Total   int64
}

// Rows fetches a page of rows; table and sort column must exist in the schema.
func (s *Service) Rows(ctx context.Context, q RowsQuery) (RowsPage, error) {
	conn, err := s.conn()
	if err != nil {
		return RowsPage{}, err
	}
	t, err := s.table(ctx, conn, q.Table)
	if err != nil {
		return RowsPage{}, err
	}
	req := db.RowsRequest{Table: t, Limit: q.Limit, Offset: q.Offset, SortDir: q.SortDir, Search: q.Search}
	if q.SortCol != "" {
		f, err := field(t, q.SortCol)
		if err != nil {
			return RowsPage{}, err
		}
		req.Sort = &f
	}

	qctx, cancel := s.bounded(ctx)
	defer cancel()
	cols, rows, total, err := conn.Impl.FetchRows(qctx, req)
	if err != nil {
		return RowsPage{}, s.classify(qctx, err, func(e error) error { return e })
	}
	return RowsPage{Columns: cols, Rows: rows, Total: total}, nil
}

// LookupRows returns up to 100 rows of table where field equals value.
func (s *Service) LookupRows(ctx context.Context, table, column, value string) ([]string, []map[string]any, error) {
	conn, err := s.conn()
	if err != nil {
		return nil, nil, err
	}
	t, err := s.table(ctx, conn, table)
	if err != nil {
		return nil, nil, err
	}
	f, err := field(t, column)
	if err != nil {
		return nil, nil, err
	}
	qctx, cancel := s.bounded(ctx)
	defer cancel()
	cols, rows, err := conn.Impl.FetchRowWhere(qctx, t, f, value)
	if err != nil {
		return nil, nil, s.classify(qctx, err, invalid)
	}
	return cols, rows, nil
}

// RowUpdate sets one column of the row identified by its full primary key.
type RowUpdate struct {
	Table  string
	Key    map[string]string // every primary-key column, and nothing else
	Column string
	Value  *string // nil writes NULL
}

// UpdateRow applies a single-cell edit to exactly one row.
func (s *Service) UpdateRow(ctx context.Context, u RowUpdate) error {
	conn, err := s.conn()
	if err != nil {
		return err
	}
	if s.access.is(conn) {
		return errReadOnly
	}
	t, err := s.table(ctx, conn, u.Table)
	if err != nil {
		return err
	}
	target, err := field(t, u.Column)
	if err != nil {
		return err
	}
	key, err := rowKey(t, u.Key)
	if err != nil {
		return err
	}
	qctx, cancel := s.bounded(ctx)
	defer cancel()
	err = conn.Impl.UpdateRow(qctx, t, key, target, u.Value)
	switch {
	case errors.Is(err, db.ErrRowNotFound):
		return classed{ErrNotFound, err}
	case err != nil:
		return s.classify(qctx, err, invalid)
	}
	return nil
}

// rowKey checks that key names exactly t's primary-key columns, so an edit
// can never match more than one row.
func rowKey(t db.Table, key map[string]string) ([]db.KeyValue, error) {
	var out []db.KeyValue
	for _, f := range t.Fields {
		if !f.IsPrimaryKey {
			continue
		}
		v, ok := key[f.Name]
		if !ok {
			return nil, invalid(fmt.Errorf("key is missing primary-key column %q", f.Name))
		}
		out = append(out, db.KeyValue{Field: f, Value: v})
	}
	if len(out) == 0 {
		return nil, invalid(fmt.Errorf("table %s has no primary key, so its rows cannot be edited", t.Name))
	}
	if len(key) != len(out) {
		return nil, invalid(errors.New("key may only contain primary-key columns"))
	}
	return out, nil
}

// QueryResult is the outcome of a console query.
type QueryResult struct {
	Columns              []string
	Rows                 []map[string]any
	RowsAffected         int64
	IsWrite              bool
	Truncated            bool // only the first MaxRows rows are included
	Statements           int  // how many ran; the rows are the last one's
	RequiresConfirmation bool
}

// Query runs console SQL; destructive SQL needs confirmed=true.
func (s *Service) Query(ctx context.Context, sql string, confirmed bool) (QueryResult, error) {
	conn, err := s.conn()
	if err != nil {
		return QueryResult{}, err
	}
	stmts := sqlscan.Split(sql, conn.Impl.Syntax())
	if len(stmts) == 0 {
		return QueryResult{}, invalid(errors.New("sql is required"))
	}
	readOnly := s.access.is(conn)
	switch {
	case readOnly: // nothing can change, so nothing needs confirming
		for i, st := range stmts {
			if st.LeavesReadOnly() {
				return QueryResult{}, invalid(fmt.Errorf("statement %d would leave read-only mode; switch it off first", i+1))
			}
		}
	case sqlscan.AnyWrite(stmts) && !confirmed:
		return QueryResult{RequiresConfirmation: true, Statements: len(stmts)}, nil
	}

	qctx, cancel := s.bounded(ctx)
	defer cancel()
	res, err := conn.Impl.ExecuteScript(qctx, stmts, db.ScriptOptions{MaxRows: s.cfg.MaxRows, ReadOnly: readOnly})
	if res.IsWrite || err != nil {
		s.schemas.invalidate() // may have run DDL, even if a later part failed
	}
	if err != nil {
		return QueryResult{}, s.classify(qctx, err, invalid)
	}
	return QueryResult{
		Columns: res.Columns, Rows: res.Rows, RowsAffected: res.RowsAffected,
		IsWrite: res.IsWrite, Truncated: res.Truncated, Statements: len(stmts),
	}, nil
}

// Seed inserts fake rows into every table of the active connection.
func (s *Service) Seed(ctx context.Context, opts seed.Options) (*seed.Result, error) {
	conn, err := s.conn()
	if err != nil {
		return nil, err
	}
	if s.access.is(conn) {
		return nil, errReadOnly
	}
	schema, err := s.schemas.get(ctx, conn, true)
	if err != nil {
		return nil, err
	}
	res, err := seed.Run(ctx, conn.Impl, schema, opts)
	if err != nil {
		return nil, invalid(err)
	}
	return res, nil
}

// ExportTarget names an ORM schema format.
type ExportTarget string

const (
	ExportPrisma  ExportTarget = "prisma"
	ExportDrizzle ExportTarget = "drizzle"
)

// Export renders the active connection's schema in the target ORM format.
func (s *Service) Export(ctx context.Context, target ExportTarget) (string, error) {
	conn, err := s.conn()
	if err != nil {
		return "", err
	}
	schema, err := s.schemas.get(ctx, conn, true)
	if err != nil {
		return "", err
	}
	dialect, err := db.ExporterFor(conn.Kind)
	if err != nil {
		return "", invalid(err)
	}
	if target == ExportDrizzle {
		return export.Drizzle(export.Build(schema, dialect)), nil
	}
	return export.Prisma(export.Build(schema, dialect)), nil
}
