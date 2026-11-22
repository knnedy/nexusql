package db

import "strings"

var likeEscaper = strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`)

// LikeContains is a LIKE pattern matching s anywhere, with backslash as the
// escape character (the default in Postgres and MySQL; SQLite needs ESCAPE '\').
func LikeContains(s string) string {
	return "%" + likeEscaper.Replace(s) + "%"
}
