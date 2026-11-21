//go:build integration

package postgres_test

import (
	"context"
	"testing"

	"github.com/knnedy/nexusql/internal/db"
	"github.com/knnedy/nexusql/internal/db/dbtest"
	"github.com/knnedy/nexusql/internal/db/postgres"
)

func TestConformance(t *testing.T) {
	dbtest.Run(t, dbtest.Harness{
		Open: func(t *testing.T) db.Provider {
			p, err := postgres.Connect(context.Background(), dbtest.PostgresDB(t))
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
