package sqlite_test

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/knnedy/nexusql/internal/db"
	"github.com/knnedy/nexusql/internal/db/dbtest"
	"github.com/knnedy/nexusql/internal/db/sqlite"
	"github.com/knnedy/nexusql/internal/seed"
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
		Export: dbtest.Export{
			Setup: []string{
				`CREATE TABLE users (id INTEGER PRIMARY KEY, email VARCHAR(255) NOT NULL UNIQUE, name TEXT,
					created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, joined DATETIME DEFAULT CURRENT_TIMESTAMP,
					active BOOLEAN NOT NULL DEFAULT 1, settings JSON, visits INTEGER NOT NULL DEFAULT 0)`,
				`CREATE TABLE posts (id INTEGER PRIMARY KEY, author_id INTEGER NOT NULL REFERENCES users (id),
					editor_id INTEGER REFERENCES users (id), title VARCHAR(200) NOT NULL DEFAULT 'it''s "new"',
					status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in progress', 'done')),
					body BLOB, score DECIMAL(10,2) DEFAULT 1.50, ratio REAL, stamp TEXT DEFAULT (datetime('now')))`,
				`CREATE INDEX posts_title_idx ON posts (title)`,
				`CREATE INDEX by_author ON posts (author_id, stamp)`,
				`CREATE TABLE categories (id INTEGER PRIMARY KEY, parent_id INTEGER REFERENCES categories (id), slug VARCHAR(40) NOT NULL,
					UNIQUE (parent_id, slug))`,
				`CREATE TABLE tags (code VARCHAR(20) PRIMARY KEY, label TEXT)`,
				`CREATE TABLE post_tags (post_id INTEGER NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
					tag_code VARCHAR(20) NOT NULL REFERENCES tags (code), PRIMARY KEY (post_id, tag_code))`,
				`CREATE TABLE regions (country CHAR(2), code VARCHAR(10), PRIMARY KEY (country, code))`,
				`CREATE TABLE offices (id INT PRIMARY KEY, country CHAR(2) NOT NULL, code VARCHAR(10) NOT NULL,
					FOREIGN KEY (country, code) REFERENCES regions (country, code) ON DELETE CASCADE ON UPDATE CASCADE)`,
				`CREATE TABLE invites (id INTEGER PRIMARY KEY AUTOINCREMENT, email VARCHAR(255) REFERENCES users (email) ON DELETE SET NULL)`,
				`CREATE TABLE "order items" (id INTEGER PRIMARY KEY, "unit price" REAL, qty INTEGER NOT NULL)`,
				`CREATE TABLE audit_log (at TEXT, msg TEXT)`,
			},
		},
		Columns: dbtest.Columns{
			Setup: []string{`CREATE TABLE d (id INTEGER PRIMARY KEY, title VARCHAR(20) DEFAULT 'it''s',
				n INTEGER DEFAULT 5, at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, price DECIMAL(10,2) DEFAULT 1.50,
				stamp TEXT DEFAULT (datetime('now')), neg INTEGER DEFAULT -1, bin BLOB DEFAULT X'00')`},
			Want: map[string][2]string{
				"id": {"INTEGER", "<none>"}, "title": {"VARCHAR(20)", "'it''s'"}, "n": {"INTEGER", "5"},
				"at": {"TIMESTAMP", "CURRENT_TIMESTAMP"}, "price": {"DECIMAL(10,2)", "1.50"},
				"stamp": {"TEXT", "(datetime('now'))"}, "neg": {"INTEGER", "-1"}, "bin": {"BLOB", "X'00'"},
			},
		},
		Seed: dbtest.Seed{
			Setup: []string{
				`CREATE TABLE files (id INTEGER PRIMARY KEY, data BLOB NOT NULL)`,
				`CREATE TABLE flags (id INTEGER PRIMARY KEY, on_off BOOLEAN NOT NULL UNIQUE)`,
				`CREATE TABLE scores (id INTEGER PRIMARY KEY, n INTEGER NOT NULL CHECK (n BETWEEN 1 AND 50))`,
				`CREATE TABLE tasks (id INTEGER PRIMARY KEY,
					status TEXT NOT NULL CHECK ("status" IN ('todo', 'doing', 'done')))`,
				`CREATE TABLE categories (id INTEGER PRIMARY KEY, parent_id INTEGER REFERENCES categories (id))`,
				`CREATE TABLE teams (id INTEGER PRIMARY KEY, captain_id INTEGER REFERENCES players (id))`,
				`CREATE TABLE players (id INTEGER PRIMARY KEY, team_id INTEGER NOT NULL REFERENCES teams (id))`,
				`CREATE TABLE memberships (player_id INTEGER NOT NULL REFERENCES players (id),
					team_id INTEGER NOT NULL REFERENCES teams (id), PRIMARY KEY (player_id, team_id))`,
				`CREATE TABLE regions (country VARCHAR(40), code VARCHAR(40), PRIMARY KEY (country, code))`,
				`CREATE TABLE offices (id INTEGER PRIMARY KEY, country VARCHAR(40) NOT NULL, code VARCHAR(40) NOT NULL,
					FOREIGN KEY (country, code) REFERENCES regions (country, code))`,
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
				`CREATE TABLE autoinc (id INTEGER PRIMARY KEY AUTOINCREMENT, v TEXT)`,
				// The word in a string, a quoted name or a comment is not the keyword.
				`CREATE TABLE not_autoinc (id INTEGER PRIMARY KEY, "autoincrement" TEXT DEFAULT 'AUTOINCREMENT' /* AUTOINCREMENT */)`,
			},
			Monotonic: map[string]bool{"autoinc.id": true, "rowid_alias.id": false, "not_autoinc.id": false},
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

func TestSeedNamesACycleItCannotBreak(t *testing.T) {
	ctx := context.Background()
	p, err := sqlite.Connect(ctx, "sqlite://:memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(p.Close)
	if _, err := dbtest.Script(ctx, p, `
		CREATE TABLE a (id INTEGER PRIMARY KEY, b_id INTEGER NOT NULL REFERENCES b (id));
		CREATE TABLE b (id INTEGER PRIMARY KEY, a_id INTEGER NOT NULL REFERENCES a (id))`, 0); err != nil {
		t.Fatal(err)
	}
	schema, err := p.IntrospectSchema(ctx, p.DefaultSchema())
	if err != nil {
		t.Fatal(err)
	}
	_, err = seed.Run(ctx, p, schema, seed.Options{RowsPerTable: 1})
	if err == nil || !strings.Contains(err.Error(), "no nullable column") || !strings.Contains(err.Error(), "a, b") {
		t.Fatalf("err = %v, want the cycle named and why it cannot be broken", err)
	}
}

func TestOnlyPlainInListsBecomeAllowedValues(t *testing.T) {
	ctx := context.Background()
	p, err := sqlite.Connect(ctx, "sqlite://:memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(p.Close)
	if _, err := dbtest.Script(ctx, p, `CREATE TABLE t (
		plain TEXT CHECK (plain IN ('a', 'it''s')),
		upper TEXT CHECK ((UPPER IN ('x'))),
		[odd col] TEXT, -- CHECK (odd IN ('comment'))
		negated TEXT CHECK (negated NOT IN ('a')),
		either TEXT CHECK (either IN ('a') OR either IS NULL),
		CONSTRAINT c CHECK ("odd col" IN ('p', 'q'))
	)`, 0); err != nil {
		t.Fatal(err)
	}
	schema, err := p.IntrospectSchema(ctx, p.DefaultSchema())
	if err != nil {
		t.Fatal(err)
	}
	want := map[string]string{
		"plain": "a|it's", "upper": "x", "odd col": "p|q", "negated": "", "either": "",
	}
	for _, f := range schema.Tables[0].Fields {
		if got := strings.Join(f.Allowed, "|"); got != want[f.Name] {
			t.Errorf("%s: allowed %q, want %q", f.Name, got, want[f.Name])
		}
	}
}

func TestForeignKeysStayEnforcedAfterAConsoleRun(t *testing.T) {
	for _, uri := range []string{"sqlite://" + filepath.Join(t.TempDir(), "fk.db"), "sqlite://:memory:"} {
		t.Run(uri, func(t *testing.T) {
			ctx := context.Background()
			p, err := sqlite.Connect(ctx, uri)
			if err != nil {
				t.Fatal(err)
			}
			t.Cleanup(p.Close)
			for _, sql := range []string{
				"CREATE TABLE a (id INTEGER PRIMARY KEY); CREATE TABLE b (a_id INTEGER REFERENCES a (id))",
				"PRAGMA foreign_keys = OFF",
			} {
				if _, err := dbtest.Script(ctx, p, sql, 0); err != nil {
					t.Fatalf("%q: %v", sql, err)
				}
			}
			if _, err := dbtest.Script(ctx, p, "INSERT INTO b VALUES (7)", 0); err == nil {
				t.Fatal("orphan row inserted: foreign keys are off after the earlier run")
			}
		})
	}
}

func TestFilesConfinedToTheRoot(t *testing.T) {
	ctx := context.Background()
	root, outside := t.TempDir(), t.TempDir()
	if err := os.Symlink(outside, filepath.Join(root, "escape")); err != nil {
		t.Fatal(err)
	}
	opts := db.Options{FileRoot: root}
	for _, c := range []struct {
		path string
		ok   bool
	}{
		{filepath.Join(root, "in.db"), true},
		{filepath.Join(root, "new", "..", "in.db"), true},
		{filepath.Join(outside, "out.db"), false},
		{filepath.Join(root, "..", filepath.Base(outside), "out.db"), false},
		{filepath.Join(root, "escape", "out.db"), false},
	} {
		p, err := sqlite.ConnectWith(ctx, "sqlite://"+c.path, opts)
		if (err == nil) != c.ok {
			t.Errorf("%s: err = %v, want allowed = %v", c.path, err, c.ok)
		}
		if p != nil {
			p.Close()
		}
	}
}

func TestNoFilesLeavesOnlyMemory(t *testing.T) {
	ctx := context.Background()
	opts := db.Options{NoFiles: true}
	if _, err := sqlite.ConnectWith(ctx, "sqlite://"+filepath.Join(t.TempDir(), "x.db"), opts); err == nil {
		t.Fatal("opened a file while files are disabled")
	}
	p, err := sqlite.ConnectWith(ctx, "sqlite://:memory:", opts)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(p.Close)
	target := filepath.Join(t.TempDir(), "other.db")
	for _, sql := range []string{
		"ATTACH DATABASE '" + target + "' AS other",
		"/* x */ attach '" + target + "' AS other",
		"VACUUM INTO '" + target + "'",
	} {
		if _, err := dbtest.Script(ctx, p, sql, 0); err == nil {
			t.Errorf("%q ran while files are confined", sql)
		}
	}
	if _, err := os.Stat(target); err == nil {
		t.Error("a file was written outside the root")
	}
}

func TestUnconfinedConsoleMayAttach(t *testing.T) {
	ctx := context.Background()
	p, err := sqlite.Connect(ctx, "sqlite://:memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(p.Close)
	if _, err := dbtest.Script(ctx, p, "ATTACH DATABASE ':memory:' AS other", 0); err != nil {
		t.Fatalf("local use lost ATTACH: %v", err)
	}
}
