package postgres

import (
	"context"
	"slices"

	"github.com/knnedy/nexusql/internal/db"
	"github.com/knnedy/nexusql/internal/sqlscan"
)

// Single-column CHECK constraints, as pg_get_constraintdef prints them.
const queryChecks = `
SELECT t.relname, a.attname, pg_get_constraintdef(con.oid)
FROM pg_constraint con
JOIN pg_class t ON t.oid = con.conrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = con.conkey[1]
WHERE con.contype = 'c' AND n.nspname = $1 AND cardinality(con.conkey) = 1
ORDER BY t.relname, con.conname
`

func (p *provider) introspectChecks(ctx context.Context, schema string, tables []db.Table) error {
	rows, err := p.pool.Query(ctx, queryChecks, schema)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var table, col, def string
		if err := rows.Scan(&table, &col, &def); err != nil {
			return err
		}
		vals := allowedFromDefinition(def, col)
		for i := range tables {
			for j := range tables[i].Fields {
				if f := &tables[i].Fields[j]; vals != nil && tables[i].Name == table && f.Name == col {
					f.Allowed = vals
				}
			}
		}
	}
	return rows.Err()
}

// allowedFromDefinition reads the values a CHECK on col lists. Postgres prints
// IN as = ANY (ARRAY[...]) and adds casts, which are removed first.
func allowedFromDefinition(def, col string) []string {
	t := db.Tokenize(def, sqlscan.Postgres)
	if len(t) == 0 || !t[0].IsWord("CHECK") {
		return nil
	}
	t = unwrap(stripCasts(t[1:]))
	for k := 0; k+3 < len(t); k++ {
		if t[k].Kind == '=' && t[k+1].IsWord("ANY") && t[k+2].IsWord("ARRAY") && t[k+3].Kind == '[' {
			end := slices.IndexFunc(t[k+4:], func(x db.Token) bool { return x.Kind == ']' })
			if end < 0 {
				return nil
			}
			end += k + 4
			t = slices.Concat(t[:k], []db.Token{{Kind: 'w', Text: "IN"}, {Kind: '('}}, t[k+4:end], []db.Token{{Kind: ')'}}, t[end+1:])
			break
		}
	}
	got, vals, ok := db.AllowedIn(t)
	if !ok || got != col {
		return nil
	}
	return vals
}

// stripCasts drops ::type suffixes, including multi-word, sized and array types.
func stripCasts(t []db.Token) []db.Token {
	var out []db.Token
	for i := 0; i < len(t); i++ {
		if t[i].Kind != ':' || i+1 >= len(t) || t[i+1].Kind != ':' {
			out = append(out, t[i])
			continue
		}
		i += 2
		for i < len(t) && t[i].Kind == 'w' && !t[i].IsWord("AND") && !t[i].IsWord("OR") && !t[i].IsWord("IS") {
			i++
		}
		if i < len(t) && t[i].Kind == '(' {
			i = db.Closing(t, i) + 1
		}
		for i+1 < len(t) && t[i].Kind == '[' && t[i+1].Kind == ']' {
			i += 2
		}
		i--
	}
	return out
}

// unwrap removes parentheses around a single token or an ARRAY[...] literal.
func unwrap(t []db.Token) []db.Token {
	for changed := true; changed; {
		changed = false
		for i := range t {
			if t[i].Kind != '(' {
				continue
			}
			j := db.Closing(t, i)
			inner := t[i+1 : j]
			if len(inner) == 1 || len(inner) > 2 && inner[0].IsWord("ARRAY") && inner[1].Kind == '[' && inner[len(inner)-1].Kind == ']' {
				t, changed = slices.Concat(t[:i], inner, t[j+1:]), true
				break
			}
		}
	}
	return t
}
