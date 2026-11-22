package mysql

import (
	"context"
	"errors"
	"strings"

	"github.com/go-sql-driver/mysql"
	"github.com/knnedy/nexusql/internal/db"
	"github.com/knnedy/nexusql/internal/sqlscan"
)

// CHECK constraint names are unique per schema, so the join by name is exact.
const queryChecks = `
SELECT tc.TABLE_NAME, cc.CONSTRAINT_NAME, cc.CHECK_CLAUSE
FROM information_schema.CHECK_CONSTRAINTS cc
JOIN information_schema.TABLE_CONSTRAINTS tc
  ON tc.CONSTRAINT_SCHEMA = cc.CONSTRAINT_SCHEMA AND tc.CONSTRAINT_NAME = cc.CONSTRAINT_NAME
WHERE cc.CONSTRAINT_SCHEMA = ? AND tc.CONSTRAINT_TYPE = 'CHECK'
ORDER BY tc.TABLE_NAME, cc.CONSTRAINT_NAME
`

// introspectChecks fills Field.Allowed. Servers before 8.0.16 have no
// CHECK_CONSTRAINTS table (they ignore CHECK), so there is nothing to read.
func (p *provider) introspectChecks(ctx context.Context, schema string, tables []db.Table) error {
	rows, err := p.conn.QueryContext(ctx, queryChecks, schema)
	var me *mysql.MySQLError
	if errors.As(err, &me) && me.Number == 1109 { // unknown table in information_schema
		return nil
	}
	if err != nil {
		return err
	}
	defer rows.Close()
	byName := map[string]*db.Table{}
	for i := range tables {
		byName[tables[i].Name] = &tables[i]
	}
	for rows.Next() {
		var table, name, clause string
		if err := rows.Scan(&table, &name, &clause); err != nil {
			return err
		}
		t := byName[table]
		if t == nil {
			continue
		}
		t.Checks = append(t.Checks, db.Check{Name: name, Expr: unescapeClause(clause)})
		col, vals := allowedFromClause(clause)
		for j := range t.Fields {
			if vals != nil && strings.EqualFold(t.Fields[j].Name, col) {
				t.Fields[j].Allowed = vals
			}
		}
	}
	return rows.Err()
}

// allowedFromClause reads a CHECK_CLAUSE listing string values. MySQL 8.4
// stores it with quotes backslash-escaped and adds charset introducers.
func allowedFromClause(clause string) (string, []string) {
	var t []db.Token
	toks := db.Tokenize(unescapeClause(clause), sqlscan.MySQL)
	for i, tk := range toks {
		if tk.Kind == 'w' && strings.HasPrefix(tk.Text, "_") && i+1 < len(toks) && toks[i+1].Kind == 's' {
			continue // _utf8mb4'x' is the string 'x'
		}
		t = append(t, tk)
	}
	col, vals, ok := db.AllowedIn(t)
	if !ok {
		return "", nil
	}
	return col, vals
}

// unescapeClause undoes the backslash escaping MySQL 8.4 stores CHECK_CLAUSE
// with; a clause with a bare quote is not escaped and is kept.
func unescapeClause(clause string) string {
	if strings.Contains(clause, `\'`) && !hasBareQuote(clause) {
		return strings.NewReplacer(`\\`, `\`, `\'`, `'`).Replace(clause)
	}
	return clause
}

// hasBareQuote reports a quote not preceded by a backslash: the clause is not escaped.
func hasBareQuote(s string) bool {
	for i := range len(s) {
		if s[i] == '\'' && (i == 0 || s[i-1] != '\\') {
			return true
		}
	}
	return false
}
