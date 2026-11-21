package sqlite

import (
	"context"
	"database/sql"
	"fmt"
	"net/url"
	"strings"

	_ "modernc.org/sqlite"

	"github.com/knnedy/nexusql/internal/db"
)

type provider struct {
	conn     *sql.DB
	inMemory bool // its one connection is the database; never close it early
}

func init() {
	db.Register(db.ProviderKindSQLite, Connect)
	db.RegisterExporter(db.ProviderKindSQLite, exporter{})
}

// Connect opens a SQLite database file and returns a db.Provider
// implementation backed by it. uri is expected in the form
// "sqlite:///absolute/path/to/file.db", or "sqlite://:memory:" for an
// ephemeral in-memory database.
func Connect(ctx context.Context, uri string) (db.Provider, error) {
	path, err := extractPath(uri)
	if err != nil {
		return nil, err
	}

	conn, err := sql.Open("sqlite", dsn(path))
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// SQLite only supports one writer at a time; a single connection avoids
	// "database is locked" errors under concurrent access from this process.
	conn.SetMaxOpenConns(1)

	if err := conn.PingContext(ctx); err != nil {
		conn.Close()
		return nil, fmt.Errorf("database unreachable: %w", err)
	}

	return &provider{conn: conn, inMemory: path == ":memory:"}, nil
}

// foreignKeys is set on every new connection: SQLite leaves foreign keys
// unenforced unless each connection turns them on.
const foreignKeys = "PRAGMA foreign_keys = ON"

// dsn opens path as a file: URI (so ? and # in names stay part of the path)
// with foreign keys enforced on every connection the pool opens.
func dsn(path string) string {
	return "file:" + (&url.URL{Path: path}).EscapedPath() + "?_pragma=foreign_keys(1)"
}

// extractPath strips the "sqlite://" scheme prefix and validates the
// remainder. Paths must be absolute (start with "/") to avoid ambiguity
// tied to the process's current working directory; ":memory:" is accepted
// as SQLite's documented in-memory database convention.
func extractPath(uri string) (string, error) {
	const prefix = "sqlite://"
	if !strings.HasPrefix(uri, prefix) {
		return "", fmt.Errorf("invalid sqlite URI: %s", db.RedactURI(uri))
	}

	path := strings.TrimPrefix(uri, prefix)

	if path == ":memory:" {
		return path, nil
	}

	if !strings.HasPrefix(path, "/") {
		return "", fmt.Errorf("sqlite path must be absolute, got: %s", db.RedactURI(uri))
	}

	return path, nil
}

func (p *provider) Kind() db.ProviderKind {
	return db.ProviderKindSQLite
}

func (p *provider) Close() {
	if p.conn != nil {
		p.conn.Close()
	}
}
