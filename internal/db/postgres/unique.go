package postgres

import (
	"context"

	"github.com/knnedy/nexusql/internal/db"
)

// Unique indexes cover unique constraints too; partial, expression and
// INCLUDE columns are left out, since they do not make the columns unique.
const queryUnique = `
SELECT t.relname, array_agg(a.attname::text ORDER BY k.ord)
FROM pg_index i
JOIN pg_class t ON t.oid = i.indrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
CROSS JOIN LATERAL unnest(i.indkey::int2[]) WITH ORDINALITY AS k(attnum, ord)
JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
WHERE n.nspname = $1 AND i.indisunique AND NOT i.indisprimary
  AND i.indpred IS NULL AND i.indexprs IS NULL AND k.ord <= i.indnkeyatts
GROUP BY t.relname, i.indexrelid
ORDER BY t.relname, i.indexrelid
`

func (p *provider) introspectUnique(ctx context.Context, schema string, tables []db.Table) error {
	rows, err := p.pool.Query(ctx, queryUnique, schema)
	if err != nil {
		return err
	}
	defer rows.Close()
	byName := map[string]*db.Table{}
	for i := range tables {
		byName[tables[i].Name] = &tables[i]
	}
	for rows.Next() {
		var table string
		var cols []string
		if err := rows.Scan(&table, &cols); err != nil {
			return err
		}
		if t := byName[table]; t != nil {
			t.Unique = append(t.Unique, cols)
		}
	}
	return rows.Err()
}
