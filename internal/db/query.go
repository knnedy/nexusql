package db

import (
	"regexp"
	"strings"
)

var destructiveKeywords = map[string]bool{
	"INSERT":   true,
	"UPDATE":   true,
	"DELETE":   true,
	"DROP":     true,
	"TRUNCATE": true,
	"ALTER":    true,
}

var leadingCommentRe = regexp.MustCompile(`^(\s*--[^\n]*\n|\s*/\*.*?\*/)*`)

func firstKeyword(sql string) string {
	stripped := leadingCommentRe.ReplaceAllString(strings.TrimSpace(sql), "")
	stripped = strings.TrimSpace(stripped)

	fields := strings.Fields(stripped)
	if len(fields) == 0 {
		return ""
	}
	return strings.ToUpper(fields[0])
}

// IsDestructiveQuery reports whether the given SQL statement begins with
// a keyword that mutates or drops data/schema. Used by the API layer to
// require explicit confirmation before executing a query from the SQL console.
func IsDestructiveQuery(sql string) bool {
	return destructiveKeywords[firstKeyword(sql)]
}

// IsSelectQuery reports whether the given SQL statement is a read-only
// statement (SELECT, WITH, EXPLAIN). Provider ExecuteQuery implementations
// use this to decide whether to auto-append a row limit and whether to
// return rows versus an affected-row count.
func IsSelectQuery(sql string) bool {
	kw := firstKeyword(sql)
	return kw == "SELECT" || kw == "WITH" || kw == "EXPLAIN"
}

var hasLimitRe = regexp.MustCompile(`(?i)\blimit\s+\d+`)

// HasExplicitLimit reports whether the SQL text already contains a LIMIT
// clause, so callers can avoid appending a duplicate/conflicting one.
func HasExplicitLimit(sql string) bool {
	return hasLimitRe.MatchString(sql)
}
