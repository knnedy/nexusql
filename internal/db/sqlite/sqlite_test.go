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
		Values: dbtest.Values{
			Setup: []string{
				`CREATE TABLE vals (id INTEGER PRIMARY KEY, big INTEGER, small INTEGER, amount NUMERIC,
					fl REAL, ts DATETIME, d DATE, js JSON, bin BLOB, flag BOOLEAN, blank TEXT)`,
				`INSERT INTO vals VALUES (1, 9007199254740993, 42, '12345.5', 1.5,
					'2026-01-02 03:04:05.5', '2026-01-02', '{"a": 1}', X'DEADBEEF', 1, NULL)`,
			},
			// NUMERIC affinity stores REAL: SQLite has no exact decimal type.
			Want: map[string]string{
				"big": `"9007199254740993"`, "small": `42`, "amount": `12345.5`, "fl": `1.5`,
				"ts": `"2026-01-02T03:04:05.5"`, "d": `"2026-01-02"`, "js": `{"a":1}`,
				"bin": `"\\xdeadbeef"`, "flag": `true`, "blank": `null`,
			},
			Stored: map[string]string{
				"typeof(big)": "integer", "typeof(fl)": "real", "typeof(bin)": "blob",
				"typeof(flag)": "integer", "typeof(js)": "text", "typeof(blank)": "null",
			},
		},
		Keys: dbtest.Keys{
			Setup: []string{
				`CREATE TABLE parent (a INTEGER, b INTEGER, PRIMARY KEY (a, b))`,
				`CREATE TABLE child (id INTEGER PRIMARY KEY, pa INTEGER, pb INTEGER,
					FOREIGN KEY (pa, pb) REFERENCES parent (a, b))`,
				`CREATE TABLE rowid_alias (id INTEGER PRIMARY KEY, v TEXT)`,
				`CREATE TABLE int_key (id INT PRIMARY KEY, v TEXT)`,
			},
			// Only a column declared exactly INTEGER PRIMARY KEY aliases the rowid.
			Auto: map[string]bool{
				"rowid_alias.id": true, "int_key.id": false, "child.id": true,
				"parent.a": false, "parent.b": false,
			},
		},
	})
}
