package db

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Connection struct {
	Pool     *pgxpool.Pool
	Provider Provider
	URI      string
}

func Connect(ctx context.Context, uri string) (*Connection, error) {
	provider, err := DetectProvider(uri)
	if err != nil {
		return nil, err
	}

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

	// verify the connection is live
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("database unreachable: %w", err)
	}

	return &Connection{
		Pool:     pool,
		Provider: provider,
		URI:      uri,
	}, nil
}

func (c *Connection) Close() {
	if c.Pool != nil {
		c.Pool.Close()
	}
}
