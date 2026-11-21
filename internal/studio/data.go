package studio

import (
	"context"
	"errors"

	"github.com/knnedy/nexusql/internal/db"
	"github.com/knnedy/nexusql/internal/seed"
)

// Schema introspects the given schema of the active connection.
func (s *Service) Schema(ctx context.Context, schema string) (*db.Schema, error) {
	conn, err := s.conn()
	if err != nil {
		return nil, err
	}
	return conn.Impl.IntrospectSchema(ctx, schema)
}

// RowsQuery selects one page of a table.
type RowsQuery struct {
	Table   string
	Limit   int
	Offset  int
	SortCol string // validated against the table's columns
	SortDir db.SortDir
	Search  string
}

// RowsPage is one page of table data.
type RowsPage struct {
	Columns []string
	Rows    []map[string]any
	Total   int64
}

// Rows fetches a page of rows after validating the sort column.
func (s *Service) Rows(ctx context.Context, q RowsQuery) (RowsPage, error) {
	conn, err := s.conn()
	if err != nil {
		return RowsPage{}, err
	}

	if q.SortCol != "" {
		if err := validateSortColumn(ctx, conn, q.Table, q.SortCol); err != nil {
			return RowsPage{}, err
		}
	}

	cols, rows, total, err := conn.Impl.FetchRows(ctx, q.Table, q.Limit, q.Offset, q.SortCol, q.SortDir, q.Search)
	if err != nil {
		return RowsPage{}, err
	}
	return RowsPage{Columns: cols, Rows: rows, Total: total}, nil
}

func validateSortColumn(ctx context.Context, conn *db.Connection, table, col string) error {
	schema, err := conn.Impl.IntrospectSchema(ctx, "public")
	if err != nil {
		return err
	}

	for _, t := range schema.Tables {
		if t.Name != table {
			continue
		}
		for _, f := range t.Fields {
			if f.Name == col {
				return nil
			}
		}
		return invalid(errors.New("invalid sort column"))
	}
	return invalid(errors.New("unknown table"))
}

// LookupRows returns up to 100 rows of table where field equals value.
func (s *Service) LookupRows(ctx context.Context, table, field, value string) ([]string, []map[string]any, error) {
	conn, err := s.conn()
	if err != nil {
		return nil, nil, err
	}
	cols, rows, err := conn.Impl.FetchRowWhere(ctx, table, field, value)
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
	if err := conn.Impl.UpdateRow(ctx, u.Table, u.PKField, u.PKValue, u.TargetField, u.NewValue); err != nil {
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
	schema, err := conn.Impl.IntrospectSchema(ctx, "public")
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
	schema, err := conn.Impl.IntrospectSchema(ctx, conn.Impl.DefaultSchema())
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
