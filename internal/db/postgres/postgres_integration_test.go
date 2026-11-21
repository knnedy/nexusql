//go:build integration

package postgres_test

import (
	"context"
	"fmt"
	"log"
	"os"
	"sync/atomic"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/knnedy/nexusql/internal/db"
	"github.com/knnedy/nexusql/internal/db/dbtest"
	"github.com/knnedy/nexusql/internal/db/postgres"
	tcpostgres "github.com/testcontainers/testcontainers-go/modules/postgres"
)

var (
	adminURI string // connects to the container's default database
	baseHost string // host:port of the container
	dbSeq    atomic.Int64
)

func TestMain(m *testing.M) {
	ctx := context.Background()
	ctr, err := tcpostgres.Run(ctx, "postgres:17-alpine",
		tcpostgres.WithUsername("nexusql"), tcpostgres.WithPassword("nexusql"),
		tcpostgres.BasicWaitStrategies())
	if err != nil {
		log.Fatalf("start postgres: %v", err)
	}
	if adminURI, err = ctr.ConnectionString(ctx, "sslmode=disable"); err != nil {
		log.Fatal(err)
	}
	if baseHost, err = ctr.PortEndpoint(ctx, "5432/tcp", ""); err != nil {
		log.Fatal(err)
	}
	code := m.Run()
	_ = ctr.Terminate(ctx)
	os.Exit(code)
}

// freshDB creates an empty database and returns its URI; it is dropped on cleanup.
func freshDB(t *testing.T) string {
	t.Helper()
	ctx := context.Background()
	name := fmt.Sprintf("t%d", dbSeq.Add(1))
	admin, err := pgx.Connect(ctx, adminURI)
	if err != nil {
		t.Fatal(err)
	}
	defer admin.Close(ctx)
	if _, err := admin.Exec(ctx, "CREATE DATABASE "+name); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		a, err := pgx.Connect(ctx, adminURI)
		if err == nil {
			_, _ = a.Exec(ctx, "DROP DATABASE IF EXISTS "+name+" WITH (FORCE)")
			a.Close(ctx)
		}
	})
	return fmt.Sprintf("postgres://nexusql:nexusql@%s/%s?sslmode=disable", baseHost, name)
}

func TestConformance(t *testing.T) {
	dbtest.Run(t, dbtest.Harness{
		Open: func(t *testing.T) db.Provider {
			p, err := postgres.Connect(context.Background(), freshDB(t))
			if err != nil {
				t.Fatalf("connect: %v", err)
			}
			t.Cleanup(p.Close)
			return p
		},
		Schema: []string{
			`CREATE TABLE users (id SERIAL PRIMARY KEY, email TEXT NOT NULL, name TEXT)`,
			`CREATE TABLE posts (
				id SERIAL PRIMARY KEY,
				user_id INTEGER NOT NULL REFERENCES users(id),
				title TEXT NOT NULL
			)`,
		},
	})
}
