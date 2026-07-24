package sqlite

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	_ "modernc.org/sqlite"

	"github.com/knnedy/nexusql/internal/db"
)

type provider struct {
	conn *sql.DB
}

func init() {
	db.Register(db.ProviderKindSQLite, Connect)
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

	conn, err := sql.Open("sqlite", path)
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

	return &provider{conn: conn}, nil
}

// extractPath strips the "sqlite://" scheme prefix and validates the
// remainder. Paths must be absolute (start with "/") to avoid ambiguity
// tied to the process's current working directory; ":memory:" is accepted
// as SQLite's documented in-memory database convention.
func extractPath(uri string) (string, error) {
	const prefix = "sqlite://"
	if !strings.HasPrefix(uri, prefix) {
		return "", fmt.Errorf("invalid sqlite URI: %s", uri)
	}

	path := strings.TrimPrefix(uri, prefix)

	if path == ":memory:" {
		return path, nil
	}

	if !strings.HasPrefix(path, "/") {
		return "", fmt.Errorf("sqlite path must be absolute, got: %s", path)
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
