package db

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/knnedy/nexusql/internal/sqlscan"
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
		return "", fmt.Errorf("unsupported or unrecognised URI scheme: %s", RedactURI(uri))
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

// SeedTx is an open seeding transaction. Each Insert runs in its own
// savepoint, so a row the database rejects leaves the transaction usable.
type SeedTx interface {
	// Insert adds a row of t, converting values like cell edits (nil: NULL),
	// and returns the database-assigned values of the auto fields, in order.
	Insert(ctx context.Context, t Table, fields []Field, values []*string, auto []Field) ([]string, error)
	Commit(ctx context.Context) error
	Rollback(ctx context.Context) error
}

// Provider is implemented once per database engine (postgres, mysql, sqlite).
// Each implementation owns its own driver connection and translates its
// native SQL dialect and type system into the canonical shapes in types.go.
// QueryResult is the outcome of console SQL.
type QueryResult struct {
	Columns      []string
	Rows         []map[string]any
	RowsAffected int64
	IsWrite      bool
	Truncated    bool // more rows existed beyond the cap
}

// ScriptOptions shape one console run.
type ScriptOptions struct {
	MaxRows  int  // rows returned from the last statement; 0 means no cap
	ReadOnly bool // the database itself refuses every write in the run
}

// KeyValue pins one primary-key column of a row.
type KeyValue struct {
	Field Field
	Value string
}

// ErrRowNotFound means no row matched the key of an update.
var ErrRowNotFound = errors.New("no row matches the key")

// RowsRequest selects one page of an introspected table.
type RowsRequest struct {
	Table   Table
	Limit   int
	Offset  int
	Sort    *Field // nil leaves the order to the database
	SortDir SortDir
	Search  string // case-insensitive match on the table's text columns
}

type Provider interface {
	Kind() ProviderKind

	IntrospectSchema(ctx context.Context, schema string) (*Schema, error)

	// Row methods take introspected tables and fields only; callers resolve
	// client input against the schema first, so providers never see raw names.
	FetchRows(ctx context.Context, req RowsRequest) (columns []string, rows []map[string]any, total int64, err error)
	FetchRowWhere(ctx context.Context, t Table, f Field, value string) ([]string, []map[string]any, error)
	// UpdateRow sets target on the row matching every key column; a nil value
	// writes NULL. It returns ErrRowNotFound when no row matches.
	UpdateRow(ctx context.Context, t Table, key []KeyValue, target Field, value *string) error

	// Syntax is the dialect's lexical rules, for splitting console SQL.
	Syntax() sqlscan.Syntax
	// ExecuteScript runs stmts in order in one session that ends with the call;
	// rows come from the last statement.
	ExecuteScript(ctx context.Context, stmts []sqlscan.Statement, opts ScriptOptions) (QueryResult, error)

	BeginSeedTx(ctx context.Context) (SeedTx, error)

	// QuoteIdentifier quotes a single identifier (column or table name)
	// per the provider's SQL dialect — double quotes for Postgres/SQLite,
	// backticks for MySQL.
	QuoteIdentifier(name string) string

	// QuoteTable quotes a table name, including its schema qualifier when
	// the provider uses one (Postgres). Providers with no schema concept
	// (MySQL, SQLite) ignore Table.Schema and behave like QuoteIdentifier.
	QuoteTable(t Table) string

	// DefaultSchema returns the schema name to introspect when the caller
	// doesn't specify one. Postgres returns "public"; MySQL and SQLite have
	// no equivalent default-schema literal (MySQL resolves the connection's
	// current database dynamically, SQLite ignores schema entirely) and
	// return "" so callers fall through to each provider's own resolution.
	DefaultSchema() string

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
