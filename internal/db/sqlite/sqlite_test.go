package sqlite_test

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/knnedy/nexusql/internal/db"
	"github.com/knnedy/nexusql/internal/db/dbtest"
	"github.com/knnedy/nexusql/internal/db/sqlite"
)

func TestConformance(t *testing.T) {
	dbtest.Run(t, dbtest.Harness{
		Open: func(t *testing.T) db.Provider {
			uri := "sqlite://" + filepath.Join(t.TempDir(), "test.db")
			p, err := sqlite.Connect(context.Background(), uri)
			if err != nil {
				t.Fatalf("connect: %v", err)
			}
			t.Cleanup(p.Close)
			return p
		},
		Schema: []string{
			`CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT NOT NULL, name TEXT)`,
			`CREATE TABLE posts (
				id INTEGER PRIMARY KEY,
				user_id INTEGER NOT NULL REFERENCES users(id),
				title TEXT NOT NULL
			)`,
		},
	})
}
