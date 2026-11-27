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
	return introspect(ctx, conn, schema)
}

// RowsQuery selects one page of a table.
type RowsQuery struct {
	Table   string
	Limit   int
	Offset  int
	SortCol string
	SortDir db.SortDir
	Search  string
	Filters []RowFilter
	After   []string // a previous page's Cursor; replaces Offset when the order allows it
}

// RowsPage is one page of table data.
type RowsPage struct {
	Columns []string
	Rows    []map[string]any
	HasMore bool
	Cursor  []string // continues after this page; nil when keyset paging does not apply
}

// CountQuery counts the rows a RowsQuery with the same search and filters pages through.
type CountQuery struct {
	Table   string
	Search  string
	Filters []RowFilter
}

// rowsRequest resolves client names against the schema into a provider request.
func (s *Service) rowsRequest(ctx context.Context, conn *db.Connection, table, search string, in []RowFilter) (db.RowsRequest, error) {
	t, err := s.table(ctx, conn, table)
	if err != nil {
		return db.RowsRequest{}, err
	}
	sch, err := s.schemas.get(ctx, conn, false)
	if err != nil {
		return db.RowsRequest{}, err
	}
	filters, err := resolveFilters(sch, t, in)
	if err != nil {
		return db.RowsRequest{}, err
	}
	return db.RowsRequest{Table: t, Search: search, Filters: filters}, nil
}

// Rows fetches a page of rows; table and sort column must exist in the schema.
func (s *Service) Rows(ctx context.Context, q RowsQuery) (RowsPage, error) {
	conn, err := s.conn()
	if err != nil {
		return RowsPage{}, err
	}
	req, err := s.rowsRequest(ctx, conn, q.Table, q.Search, q.Filters)
	if err != nil {
		return RowsPage{}, err
	}
	req.Limit, req.Offset, req.SortDir = q.Limit+1, q.Offset, q.SortDir // one extra row tells HasMore
	if q.SortCol != "" {
		f, err := field(req.Table, q.SortCol)
		if err != nil {
			return RowsPage{}, err
		}
		req.Sort = &f
	}
	keyset := keysetOrder(req)
	if len(q.After) > 0 && keyset {
		if err := checkCursor(req, q.After); err != nil {
			return RowsPage{}, err
		}
		req.After = q.After
	}

	qctx, cancel := s.bounded(ctx)
	defer cancel()
	cols, rows, err := conn.Impl.FetchRows(qctx, req)
	if err != nil {
		return RowsPage{}, s.classify(qctx, err, func(e error) error { return e })
	}
	page := RowsPage{Columns: cols, Rows: rows}
	if len(rows) > q.Limit {
		page.Rows, page.HasMore = rows[:q.Limit], true
		if keyset {
			page.Cursor = cursorOf(req, page.Rows[q.Limit-1])
		}
	}
	return page, nil
}

// Count counts the rows matching a query's search and filters.
func (s *Service) Count(ctx context.Context, q CountQuery) (int64, error) {
	conn, err := s.conn()
	if err != nil {
		return 0, err
	}
	req, err := s.rowsRequest(ctx, conn, q.Table, q.Search, q.Filters)
	if err != nil {
		return 0, err
	}
	qctx, cancel := s.bounded(ctx)
	defer cancel()
	n, err := conn.Impl.CountRows(qctx, req)
	if err != nil {
		return 0, s.classify(qctx, err, func(e error) error { return e })
	}
	return n, nil
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
	ColumnTypes          []string // as the database names them; "" when unknown
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
		Columns: res.Columns, ColumnTypes: res.ColumnTypes, Rows: res.Rows, RowsAffected: res.RowsAffected,
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

// ExportFormat describes one schema export format.
type ExportFormat = export.Format

// ExportFormats lists the schema export formats.
func (s *Service) ExportFormats() []ExportFormat { return export.Formats() }

// Export renders the active connection's schema in the format with this id;
// tables, when given, limits it to those, validated against the schema.
func (s *Service) Export(ctx context.Context, format string, tables []string) (string, error) {
	f, ok := export.Lookup(format)
	if !ok {
		return "", classed{ErrNotFound, fmt.Errorf("unknown export format %q", format)}
	}
	conn, err := s.conn()
	if err != nil {
		return "", err
	}
	schema, err := s.schemas.get(ctx, conn, true)
	if err != nil {
		return "", err
	}
	if schema, err = schema.Subset(tables); err != nil {
		return "", invalid(err)
	}
	dialect, err := db.ExporterFor(conn.Kind)
	if err != nil {
		return "", invalid(err)
	}
	return f.Render(export.Build(schema, dialect)), nil
}

// TableDDL renders one table's CREATE TABLE, indexes and foreign keys.
func (s *Service) TableDDL(ctx context.Context, table string) (string, error) {
	conn, err := s.conn()
	if err != nil {
		return "", err
	}
	t, err := s.table(ctx, conn, table)
	if err != nil {
		return "", err
	}
	schema, err := s.schemas.get(ctx, conn, false)
	if err != nil {
		return "", err
	}
	dialect, err := db.ExporterFor(conn.Kind)
	if err != nil {
		return "", invalid(err)
	}
	ddl, ok := export.TableSQL(export.Build(schema, dialect), t.Name)
	if !ok { // migration-tool tables are left out of exports
		return "", classed{ErrNotFound, fmt.Errorf("no DDL for table %q", t.Name)}
	}
	return ddl, nil
}
