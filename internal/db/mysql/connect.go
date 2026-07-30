package mysql

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	_ "github.com/go-sql-driver/mysql"

	"github.com/knnedy/nexusql/internal/db"
)

type provider struct {
	conn *sql.DB
}

func init() {
	db.Register(db.ProviderKindMySQL, Connect)
}

// Connect opens a pooled connection to a MySQL database and returns a
// db.Provider implementation backed by it. uri is expected in the form
// mysql://user:pass@host:port/dbname; it's translated into the driver's
// own DSN format, which does not use a URI scheme.
func Connect(ctx context.Context, uri string) (db.Provider, error) {
	dsn, err := toDSN(uri)
	if err != nil {
		return nil, fmt.Errorf("invalid connection URI: %w", err)
	}

	conn, err := sql.Open("mysql", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to open connection pool: %w", err)
	}

	// Mirrors the pool values used by the Postgres provider's pgxpool config.
	conn.SetMaxOpenConns(5)
	conn.SetMaxIdleConns(1)
	conn.SetConnMaxLifetime(30 * time.Minute)
	conn.SetConnMaxIdleTime(5 * time.Minute)

	pingCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	if err := conn.PingContext(pingCtx); err != nil {
		conn.Close()
		return nil, fmt.Errorf("database unreachable: %w", err)
	}

	return &provider{conn: conn}, nil
}

func (p *provider) Kind() db.ProviderKind {
	return db.ProviderKindMySQL
}

func (p *provider) Close() {
	if p.conn != nil {
		p.conn.Close()
	}
}
