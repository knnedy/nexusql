package postgres

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/knnedy/nexusql/internal/db"
)

type provider struct {
	pool *pgxpool.Pool
}

func init() {
	db.Register(db.ProviderKindPostgres, Connect)
}

// Connect opens a pooled connection to a PostgreSQL database and returns
// a db.Provider implementation backed by it.
func Connect(ctx context.Context, uri string) (db.Provider, error) {
	cfg, err := pgxpool.ParseConfig(uri)
	if err != nil {
		return nil, fmt.Errorf("invalid connection URI: %w", err)
	}

	cfg.MaxConns = 5
	cfg.MinConns = 1
	cfg.MaxConnLifetime = 30 * time.Minute
	cfg.MaxConnIdleTime = 5 * time.Minute
	cfg.ConnConfig.ConnectTimeout = 10 * time.Second

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to create connection pool: %w", err)
	}

	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("database unreachable: %w", err)
	}

	return &provider{pool: pool}, nil
}

func (p *provider) Kind() db.ProviderKind {
	return db.ProviderKindPostgres
}

func (p *provider) Close() {
	if p.pool != nil {
		p.pool.Close()
	}
}
