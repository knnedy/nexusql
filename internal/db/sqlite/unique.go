package sqlite

import (
	"context"
	"fmt"
)

// uniqueSets lists the table's unique constraints and full unique indexes,
// leaving out the primary key, partial indexes and expression indexes.
func (p *provider) uniqueSets(ctx context.Context, table string) ([][]string, error) {
	rows, err := p.conn.QueryContext(ctx, fmt.Sprintf("PRAGMA index_list(%s)", quoteIdent(table)))
	if err != nil {
		return nil, err
	}
	var names []string
	for rows.Next() {
		var seq, unique, partial int
		var name, origin string
		if err := rows.Scan(&seq, &name, &unique, &origin, &partial); err != nil {
			rows.Close()
			return nil, err
		}
		if unique == 1 && origin != "pk" && partial == 0 {
			names = append(names, name)
		}
	}
	rows.Close() // the one connection is needed for index_info below
	if err := rows.Err(); err != nil {
		return nil, err
	}

	var out [][]string
	for i := len(names) - 1; i >= 0; i-- { // index_list lists newest first
		cols, err := p.indexColumns(ctx, names[i])
		if err != nil {
			return nil, err
		}
		if cols != nil {
			out = append(out, cols)
		}
	}
	return out, nil
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
