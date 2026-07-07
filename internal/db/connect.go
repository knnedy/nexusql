package db

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type postgresProvider struct {
	pool *pgxpool.Pool
}

func connectPostgres(ctx context.Context, uri string) (Provider, error) {
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

	return &postgresProvider{pool: pool}, nil
}

func (p *postgresProvider) Kind() ProviderKind {
	return ProviderKindPostgres
}

func (p *postgresProvider) Close() {
	if p.pool != nil {
		p.pool.Close()
	}
}
