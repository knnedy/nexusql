package db

import (
	"fmt"
	"strings"
)

// Where holds one dialect's pieces of a rows WHERE clause.
type Where struct {
	Quote      func(name string) string
	Param      func(n int) string             // the nth placeholder, counting from 1
	ILike      func(col, param string) string // case-insensitive LIKE, backslash escape
	Arg        func(f Field, v string) any    // a filter value as the column's type
	Searchable func(f Field) bool
}

var comparisons = map[FilterOp]string{
	FilterEq: "=", FilterNe: "<>", FilterLt: "<", FilterLte: "<=", FilterGt: ">", FilterGte: ">=",
}

// Clause renders req's search and filters as " WHERE ..." (or "") with its
// args. Every value is a parameter; names come from the introspected table.
func (w Where) Clause(req RowsRequest) (string, []any, error) {
	var conds []string
	var args []any
	param := func(v any) string {
		args = append(args, v)
		return w.Param(len(args))
	}

	if req.Search != "" {
		var anyOf []string
		pattern := LikeContains(req.Search)
		for _, f := range req.Table.Fields {
			if w.Searchable(f) {
				anyOf = append(anyOf, w.ILike(w.Quote(f.Name), param(pattern)))
			}
		}
		if len(anyOf) > 0 {
			conds = append(conds, "("+strings.Join(anyOf, " OR ")+")")
		}
	}

	for _, f := range req.Filters {
		col := w.Quote(f.Field.Name)
		want := 1
		switch f.Op {
		case FilterIsNull, FilterNotNull:
			want = 0
		case FilterIn:
			want = max(1, len(f.Values))
		}
		if len(f.Values) != want {
			return "", nil, fmt.Errorf("filter %s on %s takes %d values, got %d", f.Op, f.Field.Name, want, len(f.Values))
		}

		switch f.Op {
		case FilterIsNull:
			conds = append(conds, col+" IS NULL")
		case FilterNotNull:
			conds = append(conds, col+" IS NOT NULL")
		case FilterContains:
			conds = append(conds, w.ILike(col, param(LikeContains(f.Values[0]))))
		case FilterStartsWith:
			conds = append(conds, w.ILike(col, param(LikePrefix(f.Values[0]))))
		case FilterIn:
			ps := make([]string, len(f.Values))
			for i, v := range f.Values {
				ps[i] = param(w.Arg(f.Field, v))
			}
			conds = append(conds, col+" IN ("+strings.Join(ps, ", ")+")")
		default:
			op, ok := comparisons[f.Op]
			if !ok {
				return "", nil, fmt.Errorf("unknown filter %q", f.Op)
			}
			conds = append(conds, col+" "+op+" "+param(w.Arg(f.Field, f.Values[0])))
		}
	}

	if len(conds) == 0 {
		return "", nil, nil
	}
	return " WHERE " + strings.Join(conds, " AND "), args, nil
}
