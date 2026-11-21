package mysql

import (
	"context"
	"database/sql"

	"github.com/knnedy/nexusql/internal/db"
)

const queryUnique = `
SELECT TABLE_NAME, INDEX_NAME, COLUMN_NAME
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = ? AND NON_UNIQUE = 0 AND INDEX_NAME <> 'PRIMARY'
ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX
`

// introspectUnique adds each unique index; one with an expression part
// (no column name) does not make columns unique and is left out.
func (p *provider) introspectUnique(ctx context.Context, schema string, tables []db.Table) error {
	rows, err := p.conn.QueryContext(ctx, queryUnique, schema)
	if err != nil {
		return err
	}
	defer rows.Close()
	type key struct{ table, index string }
	var order []key
	cols := map[key][]string{}
	skip := map[key]bool{}
	for rows.Next() {
		var k key
		var col sql.NullString
		if err := rows.Scan(&k.table, &k.index, &col); err != nil {
			return err
		}
		if _, seen := cols[k]; !seen && !skip[k] {
			order = append(order, k)
		}
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
		if t := byName[k.table]; t != nil && !skip[k] {
			t.Unique = append(t.Unique, cols[k])
		}
	}
	return nil
}
