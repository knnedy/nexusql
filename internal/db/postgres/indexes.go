package postgres

import (
	"cmp"
	"context"
	"slices"

	"github.com/knnedy/nexusql/internal/db"
)

// Unique indexes cover unique constraints too. Partial, expression and
// INCLUDE columns are left out: they do not index (or make unique) the columns.
const queryIndexes = `
SELECT t.relname, ic.relname, i.indisunique, array_agg(a.attname::text ORDER BY k.ord)
FROM pg_index i
JOIN pg_class t ON t.oid = i.indrelid
JOIN pg_class ic ON ic.oid = i.indexrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
CROSS JOIN LATERAL unnest(i.indkey::int2[]) WITH ORDINALITY AS k(attnum, ord)
JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
WHERE n.nspname = $1 AND NOT i.indisprimary
  AND i.indpred IS NULL AND i.indexprs IS NULL AND k.ord <= i.indnkeyatts
GROUP BY t.relname, ic.relname, i.indisunique, i.indexrelid
ORDER BY t.relname, i.indexrelid
`

// introspectIndexes fills each table's Unique sets and plain Indexes.
func (p *provider) introspectIndexes(ctx context.Context, schema string, tables []db.Table) error {
	rows, err := p.pool.Query(ctx, queryIndexes, schema)
	if err != nil {
		return err
	}
	defer rows.Close()
	byName := map[string]*db.Table{}
	for i := range tables {
		byName[tables[i].Name] = &tables[i]
	}
	for rows.Next() {
		var table, index string
		var unique bool
		var cols []string
		if err := rows.Scan(&table, &index, &unique, &cols); err != nil {
			return err
		}
		t := byName[table]
		switch {
		case t == nil:
		case unique:
			t.Unique = append(t.Unique, cols)
		default:
			t.Indexes = append(t.Indexes, db.Index{Name: index, Columns: cols})
		}
	}
	for _, t := range byName {
		slices.SortFunc(t.Indexes, func(a, b db.Index) int { return cmp.Compare(a.Name, b.Name) })
	}
	return rows.Err()
}
