//go:build integration

package postgres_test

import (
	"context"
	"testing"
	"time"

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
		Keys: dbtest.Keys{
			Setup: []string{
				`CREATE TABLE parent (a INTEGER, b INTEGER, PRIMARY KEY (a, b))`,
				`CREATE TABLE child (id INTEGER PRIMARY KEY, pa INTEGER, pb INTEGER,
					FOREIGN KEY (pa, pb) REFERENCES parent (a, b))`,
				`CREATE TABLE identity_key (id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY, v TEXT)`,
				`CREATE TABLE serial_key (id SERIAL PRIMARY KEY, v TEXT)`,
				// Same constraint name on two tables must not cross-flag columns.
				`CREATE TABLE twin_a (x INT, y INT, CONSTRAINT twin PRIMARY KEY (x))`,
				`CREATE TABLE twin_b (x INT, y INT, CONSTRAINT twin FOREIGN KEY (x) REFERENCES twin_a (x))`,
			},
			Auto: map[string]bool{
				"identity_key.id": true, "serial_key.id": true, "child.id": false, "parent.a": false,
			},
			PK: map[string]bool{"twin_a.x": true, "twin_b.x": false},
		},
	})
}

func TestTruncatedQueryStopsReading(t *testing.T) {
	p, err := postgres.Connect(context.Background(), dbtest.PostgresDB(t))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(p.Close)

	start := time.Now()
	res, err := p.ExecuteQuery(context.Background(), "SELECT generate_series(1, 50000000) AS g", 5) // streams; FROM would materialize
	if err != nil || len(res.Rows) != 5 || !res.Truncated {
		t.Fatalf("got %d rows truncated=%v err=%v", len(res.Rows), res.Truncated, err)
	}
	if d := time.Since(start); d > 3*time.Second {
		t.Fatalf("took %s: the remaining rows were read instead of abandoned", d)
	}
	if _, err := p.ExecuteQuery(context.Background(), "SELECT 1", 0); err != nil {
		t.Fatalf("pool unusable after truncation: %v", err)
	}
}
