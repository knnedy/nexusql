package db

import (
	"context"
	"fmt"
	"strings"
)

type ProviderKind string

const (
	ProviderKindPostgres ProviderKind = "postgres"
	ProviderKindMySQL    ProviderKind = "mysql"
	ProviderKindSQLite   ProviderKind = "sqlite"
)

func DetectProviderKind(uri string) (ProviderKind, error) {
	switch {
	case strings.HasPrefix(uri, "postgres://"), strings.HasPrefix(uri, "postgresql://"):
		return ProviderKindPostgres, nil
	case strings.HasPrefix(uri, "mysql://"):
		return ProviderKindMySQL, nil
	case strings.HasPrefix(uri, "sqlite://"):
		return ProviderKindSQLite, nil
	default:
		return "", fmt.Errorf("unsupported or unrecognised URI scheme: %s", uri)
	}
}

func (k ProviderKind) Validate() error {
	switch k {
	case ProviderKindPostgres, ProviderKindMySQL, ProviderKindSQLite:
		return nil
	default:
		return fmt.Errorf("unsupported provider: %s", k)
	}
}

// Provider is implemented once per database engine (postgres, mysql, sqlite).
// Each implementation owns its own driver connection and translates its
// native SQL dialect and type system into the canonical shapes in types.go.
type Provider interface {
	Kind() ProviderKind

	IntrospectSchema(ctx context.Context, schema string) (*Schema, error)

	FetchRows(ctx context.Context, tableName string, limit, offset int, sortCol string, sortDir SortDir, search string) ([]string, []map[string]any, int64, error)
	FetchRowWhere(ctx context.Context, tableName, field, value string) ([]string, []map[string]any, error)
	UpdateRow(ctx context.Context, tableName, pkField, pkValue, targetField, newValue string) error

	ExecuteQuery(ctx context.Context, sql string) (columns []string, rows []map[string]any, rowsAffected int64, isWrite bool, err error)

	Close()
}

// Connection wraps a live Provider implementation for the active session.
type Connection struct {
	Impl Provider
	Kind ProviderKind
	URI  string
}

func Connect(ctx context.Context, uri string) (*Connection, error) {
	kind, err := DetectProviderKind(uri)
	if err != nil {
		return nil, err
	}

	var impl Provider
	switch kind {
	case ProviderKindPostgres:
		impl, err = connectPostgres(ctx, uri)
	default:
		return nil, fmt.Errorf("provider not yet supported: %s", kind)
	}

	if err != nil {
		return nil, err
	}

	return &Connection{
		Impl: impl,
		Kind: kind,
		URI:  uri,
	}, nil
}

func (c *Connection) Close() {
	if c.Impl != nil {
		c.Impl.Close()
	}
}
