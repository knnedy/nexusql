package sqlite_test

import (
	"context"
	"fmt"
	"path/filepath"
	"testing"

	"github.com/knnedy/nexusql/internal/db"
	"github.com/knnedy/nexusql/internal/db/dbtest"
	"github.com/knnedy/nexusql/internal/db/sqlite"
	"github.com/knnedy/nexusql/internal/sqlscan"
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
		Seed: dbtest.Seed{
			Setup: []string{
				`CREATE TABLE files (id INTEGER PRIMARY KEY, data BLOB NOT NULL)`,
				`CREATE TABLE flags (id INTEGER PRIMARY KEY, on_off BOOLEAN NOT NULL UNIQUE)`,
				`CREATE TABLE scores (id INTEGER PRIMARY KEY, n INTEGER NOT NULL CHECK (n BETWEEN 1 AND 50))`,
			},
			Stored: map[string]string{
				"SELECT COUNT(*) FROM files WHERE typeof(data) <> 'blob'":      "0",
				"SELECT COUNT(*) FROM flags WHERE typeof(on_off) <> 'integer'": "0",
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

func TestInMemoryDatabaseSurvivesRuns(t *testing.T) {
	ctx := context.Background()
	p, err := sqlite.Connect(ctx, "sqlite://:memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(p.Close)

	for _, sql := range []string{
		"CREATE TABLE t (x INT); INSERT INTO t VALUES (1)",
		"BEGIN; INSERT INTO t VALUES (2)", // never committed
	} {
		if _, err := dbtest.Script(ctx, p, sql, 0); err != nil {
			t.Fatalf("%q: %v", sql, err)
		}
	}
	ro := db.ScriptOptions{ReadOnly: true}
	if _, err := p.ExecuteScript(ctx, sqlscan.Split("INSERT INTO t VALUES (3)", p.Syntax()), ro); err == nil {
		t.Fatal("write succeeded in read-only mode")
	}
	res, err := dbtest.Script(ctx, p, "SELECT count(*) AS n FROM t", 0)
	if err != nil || fmt.Sprint(res.Rows[0]["n"]) != "1" {
		t.Fatalf("rows %v err %v, want the table kept with only the committed row", res.Rows, err)
	}
	if _, err := dbtest.Script(ctx, p, "INSERT INTO t VALUES (4)", 0); err != nil {
		t.Fatalf("read-only mode outlived its run: %v", err)
	}
}

func TestReturningRows(t *testing.T) {
	ctx := context.Background()
	p, err := sqlite.Connect(ctx, "sqlite://"+filepath.Join(t.TempDir(), "r.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(p.Close)
	res, err := dbtest.Script(ctx, p,
		"CREATE TABLE ret (id INTEGER PRIMARY KEY, v TEXT); INSERT INTO ret (v) VALUES ('a'), ('b') RETURNING id", 0)
	if err != nil || len(res.Rows) != 2 || !res.IsWrite {
		t.Fatalf("got %+v err %v, want the 2 returned ids", res, err)
	}
}
