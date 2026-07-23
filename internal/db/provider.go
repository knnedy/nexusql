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

// SeedTx represents an open transaction used for seeding. Callers must
// call Commit or Rollback exactly once.
type SeedTx interface {
	// InsertReturningPK executes an INSERT ... RETURNING <pkColumn> statement
	// and returns the generated primary key as a string.
	InsertReturningPK(ctx context.Context, sql string, pkColumn string) (string, error)
	Commit(ctx context.Context) error
	Rollback(ctx context.Context) error
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

	BeginSeedTx(ctx context.Context) (SeedTx, error)

	Close()
}

// Connection wraps a live Provider implementation for the active session.
type Connection struct {
	Impl Provider
	Kind ProviderKind
	URI  string
}

type providerConstructor func(ctx context.Context, uri string) (Provider, error)

var registry = map[ProviderKind]providerConstructor{}

// Register makes a provider constructor available to Connect. Provider
// packages call this from an init() function so that db never needs to
// import them directly, avoiding an import cycle.
func Register(kind ProviderKind, constructor providerConstructor) {
	registry[kind] = constructor
}

func Connect(ctx context.Context, uri string) (*Connection, error) {
	kind, err := DetectProviderKind(uri)
	if err != nil {
		return nil, err
	}

	constructor, ok := registry[kind]
	if !ok {
		return nil, fmt.Errorf("provider not yet supported: %s", kind)
	}

	impl, err := constructor(ctx, uri)
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
