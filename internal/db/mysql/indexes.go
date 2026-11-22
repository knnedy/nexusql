package mysql

import (
	"context"
	"database/sql"

	"github.com/knnedy/nexusql/internal/db"
)

const queryIndexes = `
SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, COLUMN_NAME
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = ? AND INDEX_NAME <> 'PRIMARY'
ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX
`

// introspectIndexes fills each table's Unique sets and plain Indexes, in
// index name order. An index with an expression part (no column name) is left out.
func (p *provider) introspectIndexes(ctx context.Context, schema string, tables []db.Table) error {
	rows, err := p.conn.QueryContext(ctx, queryIndexes, schema)
	if err != nil {
		return err
	}
	defer rows.Close()
	type key struct{ table, index string }
	var order []key
	cols := map[key][]string{}
	unique := map[key]bool{}
	skip := map[key]bool{}
	for rows.Next() {
		var k key
		var nonUnique int
		var col sql.NullString
		if err := rows.Scan(&k.table, &k.index, &nonUnique, &col); err != nil {
			return err
		}
		if _, seen := cols[k]; !seen && !skip[k] {
			order = append(order, k)
		}
		unique[k] = nonUnique == 0
		if !col.Valid {
			skip[k] = true
			continue
		}
		cols[k] = append(cols[k], col.String)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	byName := map[string]*db.Table{}
	for i := range tables {
		byName[tables[i].Name] = &tables[i]
	}
	for _, k := range order {
		t := byName[k.table]
		switch {
		case t == nil || skip[k]:
		case unique[k]:
			t.Unique = append(t.Unique, cols[k])
		default:
			t.Indexes = append(t.Indexes, db.Index{Name: k.index, Columns: cols[k]})
		}
	}
	return nil
}
