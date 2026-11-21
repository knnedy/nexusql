package studio

import (
	"context"
	"errors"

	"github.com/knnedy/nexusql/internal/db"
	"github.com/knnedy/nexusql/internal/seed"
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

	cols, rows, total, err := conn.Impl.FetchRows(ctx, req)
	if err != nil {
		return RowsPage{}, err
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
	cols, rows, err := conn.Impl.FetchRowWhere(ctx, t, f, value)
	if err != nil {
		return nil, nil, invalid(err)
	}
	return cols, rows, nil
}

// RowUpdate sets one column of the row identified by a single-column key.
type RowUpdate struct {
	Table       string
	PKField     string
	PKValue     string
	TargetField string
	NewValue    string
}

// UpdateRow applies a single-cell edit.
func (s *Service) UpdateRow(ctx context.Context, u RowUpdate) error {
	conn, err := s.conn()
	if err != nil {
		return err
	}
	t, err := s.table(ctx, conn, u.Table)
	if err != nil {
		return err
	}
	pk, err := field(t, u.PKField)
	if err != nil {
		return err
	}
	target, err := field(t, u.TargetField)
	if err != nil {
		return err
	}
	if err := conn.Impl.UpdateRow(ctx, t, pk, u.PKValue, target, u.NewValue); err != nil {
		return invalid(err)
	}
	return nil
}

// QueryResult is the outcome of a console query.
type QueryResult struct {
	Columns              []string
	Rows                 []map[string]any
	RowsAffected         int64
	IsWrite              bool
	RequiresConfirmation bool
}

// Query runs console SQL; destructive SQL needs confirmed=true.
func (s *Service) Query(ctx context.Context, sql string, confirmed bool) (QueryResult, error) {
	conn, err := s.conn()
	if err != nil {
		return QueryResult{}, err
	}
	if sql == "" {
		return QueryResult{}, invalid(errors.New("sql is required"))
	}
	if db.IsDestructiveQuery(sql) && !confirmed {
		return QueryResult{RequiresConfirmation: true}, nil
	}

	cols, rows, affected, isWrite, err := conn.Impl.ExecuteQuery(ctx, sql)
	if isWrite || err != nil {
		s.schemas.invalidate() // may have run DDL, even if a later part failed
	}
	if err != nil {
		return QueryResult{}, invalid(err)
	}
	return QueryResult{Columns: cols, Rows: rows, RowsAffected: affected, IsWrite: isWrite}, nil
}

// Seed inserts fake rows into every table of the active connection.
func (s *Service) Seed(ctx context.Context, opts seed.Options) (*seed.Result, error) {
	conn, err := s.conn()
	if err != nil {
		return nil, err
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
	exp, err := db.ExporterFor(conn.Kind)
	if err != nil {
		return "", invalid(err)
	}
	if target == ExportDrizzle {
		return exp.Drizzle(schema), nil
	}
	return exp.Prisma(schema), nil
}
