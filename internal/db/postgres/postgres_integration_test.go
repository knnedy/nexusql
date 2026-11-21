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
		Values: dbtest.Values{
			Setup: []string{
				`CREATE TABLE vals (id INT PRIMARY KEY, big BIGINT, small INT, amount NUMERIC(30,6),
					fl DOUBLE PRECISION, ts TIMESTAMP, tstz TIMESTAMPTZ, d DATE, js JSONB, bin BYTEA,
					flag BOOLEAN, u UUID, blank TEXT)`,
				`INSERT INTO vals VALUES (1, 9007199254740993, 42, 12345678901234567.123456, 'NaN',
					'2026-01-02 03:04:05.5', '2026-01-02 03:04:05+03', '2026-01-02', '{"a": 1}',
					'\xdeadbeef', true, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', NULL)`,
			},
			Want: map[string]string{
				"big": `"9007199254740993"`, "small": `42`, "amount": `"12345678901234567.123456"`,
				"fl": `"NaN"`, "ts": `"2026-01-02T03:04:05.5"`, "tstz": `"2026-01-02T00:04:05Z"`,
				"d": `"2026-01-02"`, "js": `{"a":1}`, "bin": `"\\xdeadbeef"`, "flag": `true`,
				"u": `"a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"`, "blank": `null`,
			},
		},
	})
}
