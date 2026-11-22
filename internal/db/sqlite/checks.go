package sqlite

import (
	"strings"

	"github.com/knnedy/nexusql/internal/db"
	"github.com/knnedy/nexusql/internal/sqlscan"
)

// allowedValues reads every CHECK (col IN (...)) constraint in a CREATE TABLE,
// keyed by lower-cased column (SQLite names ignore case); other shapes are ignored.
func allowedValues(createSQL string) map[string][]string {
	toks := db.Tokenize(createSQL, sqlscan.SQLite)
	out := map[string][]string{}
	for i := 0; i < len(toks); i++ {
		if !toks[i].IsWord("CHECK") || i+1 >= len(toks) || toks[i+1].Kind != '(' {
			continue
		}
		end := db.Closing(toks, i+1)
		if col, vals, ok := db.AllowedIn(toks[i+2 : end]); ok {
			out[strings.ToLower(col)] = vals
		}
		i = end
	}
	return out
}
