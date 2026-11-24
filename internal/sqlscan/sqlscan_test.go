package sqlscan_test

import (
	"slices"
	"testing"

	"github.com/knnedy/nexusql/internal/sqlscan"
)

func texts(stmts []sqlscan.Statement) []string {
	out := make([]string, len(stmts))
	for i, s := range stmts {
		out[i] = s.Text
	}
	return out
}

func TestSplit(t *testing.T) {
	for _, c := range []struct {
		name   string
		syntax sqlscan.Syntax
		in     string
		want   []string
	}{
		{"semicolons separate", sqlscan.Postgres, "SELECT 1; SELECT 2;", []string{"SELECT 1", "SELECT 2"}},
		{"empty and comment-only statements dropped", sqlscan.Postgres, " ; -- note\n; /* x */ SELECT 1 ;;", []string{"/* x */ SELECT 1"}},
		{"semicolon in string", sqlscan.SQLite, "SELECT 'a;b'; SELECT 2", []string{"SELECT 'a;b'", "SELECT 2"}},
		{"doubled quote in string", sqlscan.SQLite, "SELECT 'it''s;'; SELECT 2", []string{"SELECT 'it''s;'", "SELECT 2"}},
		{"semicolon in quoted identifier", sqlscan.Postgres, `SELECT "a;b" FROM t; SELECT 2`, []string{`SELECT "a;b" FROM t`, "SELECT 2"}},
		{"semicolon in backticks", sqlscan.MySQL, "SELECT `a;b` FROM t; SELECT 2", []string{"SELECT `a;b` FROM t", "SELECT 2"}},
		{"semicolon in brackets", sqlscan.SQLite, "SELECT [a;b] FROM t; SELECT 2", []string{"SELECT [a;b] FROM t", "SELECT 2"}},
		{"semicolon in line comment", sqlscan.SQLite, "SELECT 1 -- a;b\n; SELECT 2", []string{"SELECT 1 -- a;b", "SELECT 2"}},
		{"semicolon in block comment", sqlscan.SQLite, "SELECT /* a;b */ 1; SELECT 2", []string{"SELECT /* a;b */ 1", "SELECT 2"}},
		{"postgres nests block comments", sqlscan.Postgres, "SELECT /* a /* b; */ c; */ 1; SELECT 2", []string{"SELECT /* a /* b; */ c; */ 1", "SELECT 2"}},
		{"mysql does not nest block comments", sqlscan.MySQL, "SELECT /* a /* b */ 1; SELECT 2", []string{"SELECT /* a /* b */ 1", "SELECT 2"}},
		{"postgres dollar quotes", sqlscan.Postgres,
			"CREATE FUNCTION f() RETURNS int AS $body$ BEGIN; RETURN 1; END $body$ LANGUAGE plpgsql; SELECT 2",
			[]string{"CREATE FUNCTION f() RETURNS int AS $body$ BEGIN; RETURN 1; END $body$ LANGUAGE plpgsql", "SELECT 2"}},
		{"postgres positional params are not dollar quotes", sqlscan.Postgres, "SELECT $1; SELECT 2", []string{"SELECT $1", "SELECT 2"}},
		{"mysql backslash escapes", sqlscan.MySQL, `SELECT 'a\';b'; SELECT 2`, []string{`SELECT 'a\';b'`, "SELECT 2"}},
		{"sqlite has no backslash escapes", sqlscan.SQLite, `SELECT 'a\'; SELECT 2`, []string{`SELECT 'a\'`, "SELECT 2"}},
		{"postgres E strings escape", sqlscan.Postgres, `SELECT E'a\';b'; SELECT 2`, []string{`SELECT E'a\';b'`, "SELECT 2"}},
		{"mysql hash comments", sqlscan.MySQL, "SELECT 1 # a;b\n; SELECT 2", []string{"SELECT 1 # a;b", "SELECT 2"}},
		{"sqlite trigger body keeps its semicolons", sqlscan.SQLite,
			"CREATE TRIGGER t AFTER INSERT ON a BEGIN UPDATE b SET n = n + 1; DELETE FROM c; END; SELECT 2",
			[]string{"CREATE TRIGGER t AFTER INSERT ON a BEGIN UPDATE b SET n = n + 1; DELETE FROM c; END", "SELECT 2"}},
		{"case inside a trigger body", sqlscan.SQLite,
			"CREATE TRIGGER t AFTER INSERT ON a BEGIN UPDATE b SET n = CASE WHEN 1 THEN 2 END; END; SELECT 2",
			[]string{"CREATE TRIGGER t AFTER INSERT ON a BEGIN UPDATE b SET n = CASE WHEN 1 THEN 2 END; END", "SELECT 2"}},
		{"mysql procedure with END IF", sqlscan.MySQL,
			"CREATE PROCEDURE p() BEGIN IF 1 THEN SELECT 1; END IF; SELECT 2; END; SELECT 3",
			[]string{"CREATE PROCEDURE p() BEGIN IF 1 THEN SELECT 1; END IF; SELECT 2; END", "SELECT 3"}},
		{"transaction BEGIN is its own statement", sqlscan.SQLite, "BEGIN; SELECT 1; COMMIT", []string{"BEGIN", "SELECT 1", "COMMIT"}},
		{"unterminated string swallows the rest", sqlscan.SQLite, "SELECT 'a; SELECT 2", []string{"SELECT 'a; SELECT 2"}},
	} {
		t.Run(c.name, func(t *testing.T) {
			if got := texts(sqlscan.Split(c.in, c.syntax)); !slices.Equal(got, c.want) {
				t.Fatalf("Split(%q)\n got  %q\n want %q", c.in, got, c.want)
			}
		})
	}
}

func TestClassify(t *testing.T) {
	for _, c := range []struct {
		syntax      sqlscan.Syntax
		in          string
		write, rows bool
	}{
		{sqlscan.Postgres, "SELECT * FROM t", false, true},
		{sqlscan.Postgres, "  -- lead\n /* x */ select 1", false, true},
		{sqlscan.Postgres, "SELECT * INTO copy FROM t", true, false},
		{sqlscan.Postgres, "SELECT * FROM t FOR UPDATE", true, true},
		{sqlscan.Postgres, "SELECT 'insert into' AS s", false, true},
		{sqlscan.Postgres, `SELECT "delete" FROM t`, false, true},
		{sqlscan.Postgres, "VALUES (1), (2)", false, true},
		{sqlscan.Postgres, "TABLE users", false, true},
		{sqlscan.Postgres, "WITH a AS (SELECT 1) SELECT * FROM a", false, true},
		{sqlscan.Postgres, "WITH d AS (DELETE FROM t RETURNING *) SELECT * FROM d", true, true},
		{sqlscan.Postgres, "WITH a AS (SELECT 1) INSERT INTO t SELECT * FROM a", true, false},
		{sqlscan.Postgres, "EXPLAIN SELECT 1", false, true},
		{sqlscan.Postgres, "EXPLAIN ANALYZE DELETE FROM t", true, true},
		{sqlscan.Postgres, "SHOW search_path", false, true},
		{sqlscan.MySQL, "SHOW TABLES", false, true},
		{sqlscan.MySQL, "DESCRIBE t", false, true},
		{sqlscan.SQLite, "PRAGMA table_info(t)", false, true},
		{sqlscan.SQLite, "PRAGMA foreign_keys = ON", true, true},
		{sqlscan.Postgres, "INSERT INTO t VALUES (1)", true, false},
		{sqlscan.Postgres, "INSERT INTO t VALUES (1) RETURNING id", true, true},
		{sqlscan.Postgres, "UPDATE t SET a = 1", true, false},
		{sqlscan.Postgres, "DELETE FROM t", true, false},
		{sqlscan.MySQL, "REPLACE INTO t VALUES (1)", true, false},
		{sqlscan.Postgres, "DROP TABLE t", true, false},
		{sqlscan.Postgres, "TRUNCATE t", true, false},
		{sqlscan.Postgres, "CREATE TABLE t (a int)", true, false},
		{sqlscan.Postgres, "GRANT ALL ON t TO u", true, false},
		{sqlscan.Postgres, "SET search_path = x", true, false},
		{sqlscan.Postgres, "VACUUM", true, false},
		{sqlscan.Postgres, "BEGIN", false, false},
		{sqlscan.MySQL, "START TRANSACTION", false, false},
		{sqlscan.Postgres, "COMMIT", false, false},
		{sqlscan.Postgres, "ROLLBACK", false, false},
		{sqlscan.Postgres, "frobnicate the database", true, false},
		// may write, and may return rows: OUT parameters, a cursor, a prepared SELECT
		{sqlscan.Postgres, "CALL double_it(21)", true, true},
		{sqlscan.MySQL, "CALL emails()", true, true},
		{sqlscan.Postgres, "FETCH 2 FROM c", true, true},
		{sqlscan.Postgres, "EXECUTE q", true, true},
		{sqlscan.MySQL, "EXECUTE q USING @a", true, true},
	} {
		stmts := sqlscan.Split(c.in, c.syntax)
		if len(stmts) != 1 {
			t.Fatalf("%q: split into %d statements", c.in, len(stmts))
		}
		if s := stmts[0]; s.Write != c.write || s.Rows != c.rows {
			t.Errorf("%q: write=%v rows=%v, want write=%v rows=%v", c.in, s.Write, s.Rows, c.write, c.rows)
		}
	}
}

func TestAnyWrite(t *testing.T) {
	if sqlscan.AnyWrite(sqlscan.Split("SELECT 1; SELECT 2", sqlscan.SQLite)) {
		t.Error("two reads reported as a write")
	}
	if !sqlscan.AnyWrite(sqlscan.Split("SELECT 1; DELETE FROM t", sqlscan.SQLite)) {
		t.Error("a trailing DELETE was missed")
	}
}

func TestOnlyReads(t *testing.T) {
	for sql, want := range map[string]bool{
		"SELECT 1; SHOW TABLES":         true,
		"SELECT 1; BEGIN":               false, // leaves a transaction open
		"SELECT 1; SET search_path = x": false,
		"SELECT * FROM t FOR UPDATE":    false,
	} {
		if got := sqlscan.OnlyReads(sqlscan.Split(sql, sqlscan.Postgres)); got != want {
			t.Errorf("OnlyReads(%q) = %v, want %v", sql, got, want)
		}
	}
}

func TestLeavesReadOnly(t *testing.T) {
	for sql, want := range map[string]bool{
		"SET TRANSACTION READ WRITE":                            true,
		"SET SESSION CHARACTERISTICS AS TRANSACTION READ WRITE": true,
		"START TRANSACTION READ WRITE":                          true,
		"SET SESSION transaction_read_only = 0":                 true,
		"SET @@session.tx_read_only = OFF":                      true,
		"PRAGMA query_only = OFF":                               true,
		"pragma QUERY_ONLY(0)":                                  true,
		"SELECT 'read write', 'query_only' -- read_only":        false,
		"SELECT read_count, write_count FROM stats":             false,
		"BEGIN": false,
	} {
		if got := sqlscan.Split(sql, sqlscan.MySQL)[0].LeavesReadOnly(); got != want {
			t.Errorf("LeavesReadOnly(%q) = %v, want %v", sql, got, want)
		}
	}
}
