package sqlite

import (
	"cmp"
	"context"
	"fmt"
	"slices"

	"github.com/knnedy/nexusql/internal/db"
)

// indexes lists the table's unique constraints and full unique indexes, then
// its plain indexes by name; the primary key, partial and expression indexes are left out.
func (p *provider) indexes(ctx context.Context, table string) ([][]string, []db.Index, error) {
	rows, err := p.conn.QueryContext(ctx, fmt.Sprintf("PRAGMA index_list(%s)", quoteIdent(table)))
	if err != nil {
		return nil, nil, err
	}
	var names []string
	plain := map[string]bool{}
	for rows.Next() {
		var seq, unique, partial int
		var name, origin string
		if err := rows.Scan(&seq, &name, &unique, &origin, &partial); err != nil {
			rows.Close()
			return nil, nil, err
		}
		if partial == 0 && (unique == 1 && origin != "pk" || unique == 0 && origin == "c") {
			names = append(names, name)
			plain[name] = unique == 0
		}
	}
	rows.Close() // the one connection is needed for index_info below
	if err := rows.Err(); err != nil {
		return nil, nil, err
	}

	var sets [][]string
	var idx []db.Index
	for i := len(names) - 1; i >= 0; i-- { // index_list lists newest first
		cols, err := p.indexColumns(ctx, names[i])
		if err != nil {
			return nil, nil, err
		}
		switch {
		case cols == nil:
		case plain[names[i]]:
			idx = append(idx, db.Index{Name: names[i], Columns: cols})
		default:
			sets = append(sets, cols)
		}
	}
	slices.SortFunc(idx, func(a, b db.Index) int { return cmp.Compare(a.Name, b.Name) })
	return sets, idx, nil
}

// indexColumns returns the index's columns in order, or nil when a part is an expression.
func (p *provider) indexColumns(ctx context.Context, index string) ([]string, error) {
	rows, err := p.conn.QueryContext(ctx, fmt.Sprintf("PRAGMA index_info(%s)", quoteIdent(index)))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var cols []string
	expr := false
	for rows.Next() {
		var seqno, cid int
		var name *string
		if err := rows.Scan(&seqno, &cid, &name); err != nil {
			return nil, err
		}
		if cid < 0 || name == nil {
			expr = true
			continue
		}
		cols = append(cols, *name)
	}
	if expr {
		return nil, rows.Err()
	}
	return cols, rows.Err()
}
