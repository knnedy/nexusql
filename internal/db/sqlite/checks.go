package sqlite

import (
	"strings"

	"github.com/knnedy/nexusql/internal/db"
	"github.com/knnedy/nexusql/internal/sqlscan"
)

// checks reads every CHECK constraint in a CREATE TABLE as written, and the
// values each CHECK (col IN (...)) allows, keyed by lower-cased column (SQLite
// names ignore case).
func checks(createSQL string) ([]db.Check, map[string][]string) {
	toks := db.Tokenize(createSQL, sqlscan.SQLite)
	var out []db.Check
	allowed := map[string][]string{}
	for i := 0; i < len(toks); i++ {
		if !toks[i].IsWord("CHECK") || i+1 >= len(toks) || toks[i+1].Kind != '(' {
			continue
		}
		end := db.Closing(toks, i+1)
		c := db.Check{Expr: strings.TrimSpace(createSQL[toks[i+1].End:toks[end].Pos])}
		if i >= 2 && toks[i-2].IsWord("CONSTRAINT") {
			c.Name = toks[i-1].Text
		}
		out = append(out, c)
		if col, vals, ok := db.AllowedIn(toks[i+2 : end]); ok {
			allowed[strings.ToLower(col)] = vals
		}
		i = end
	}
	return out, allowed
}
