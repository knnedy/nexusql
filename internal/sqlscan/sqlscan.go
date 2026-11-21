// Package sqlscan splits console SQL into statements and classifies each one,
// using a lexer that understands quotes and comments rather than regexes.
// It has no dependencies; providers pick the Syntax of their dialect.
package sqlscan

import (
	"slices"
	"strings"
)

// Syntax lists the lexical rules that differ between dialects.
type Syntax struct {
	DollarQuotes     bool // $tag$ ... $tag$ strings
	NestedComments   bool // /* /* */ */ nest
	EscapeStrings    bool // E'...' strings take backslash escapes
	BackslashEscapes bool // every quoted string takes backslash escapes
	HashComments     bool // # starts a line comment
	DashNeedsSpace   bool // -- starts a comment only when followed by whitespace
	Brackets         bool // [identifier]
}

var (
	Postgres = Syntax{DollarQuotes: true, NestedComments: true, EscapeStrings: true}
	MySQL    = Syntax{BackslashEscapes: true, HashComments: true, DashNeedsSpace: true}
	SQLite   = Syntax{Brackets: true}
)

// Statement is one statement of console input.
type Statement struct {
	Text string // without its terminating semicolon
	// Write: may change data, schema, settings or locks. Statements this
	// package does not recognise count as writes. Side effects of functions
	// (nextval, set_config) are invisible to it.
	Write bool
	Rows  bool // expected to return a result set

	words []string // upper-cased words outside strings and comments
}

// LeavesReadOnly reports whether the statement names a way out of read-only
// mode (READ WRITE, *_READ_ONLY settings, SQLite's query_only).
func (s Statement) LeavesReadOnly() bool {
	for i, w := range s.words {
		if w == "QUERY_ONLY" || strings.HasSuffix(w, "READ_ONLY") ||
			(w == "READ" && i+1 < len(s.words) && s.words[i+1] == "WRITE") {
			return true
		}
	}
	return false
}

// AnyWrite reports whether any statement may write.
func AnyWrite(stmts []Statement) bool {
	for _, s := range stmts {
		if s.Write {
			return true
		}
	}
	return false
}

// OnlyReads reports whether every statement just reads, so the session it ran
// in is left as it was found: no transaction, setting, lock or temp table.
func OnlyReads(stmts []Statement) bool {
	for _, s := range stmts {
		if s.Write || !s.Rows {
			return false
		}
	}
	return true
}

// Split cuts sql at top-level semicolons; semicolons inside strings, quoted
// identifiers, comments and trigger or procedure bodies stay put. Statements
// with no words (empty or comment-only) are dropped.
func Split(sql string, syn Syntax) []Statement {
	var (
		out        []Statement
		words      []string // upper-cased words and "=" outside strings and comments
		start      int
		depth      int  // BEGIN/CASE nesting inside a compound CREATE
		pendingEnd bool // END seen; END IF/LOOP/WHILE/REPEAT do not close a block
	)
	compound := func() bool {
		if len(words) == 0 || words[0] != "CREATE" {
			return false
		}
		for _, w := range words {
			switch w {
			case "TRIGGER", "PROCEDURE", "FUNCTION", "EVENT":
				return true
			}
		}
		return false
	}
	settleEnd := func(next string) {
		if !pendingEnd {
			return
		}
		pendingEnd = false
		switch next {
		case "IF", "LOOP", "WHILE", "REPEAT":
		default:
			depth--
		}
	}
	flush := func(end int) {
		if len(words) > 0 {
			out = append(out, classify(strings.TrimSpace(sql[start:end]), words))
		}
		words, depth, pendingEnd, start = nil, 0, false, end+1
	}

	for i := 0; i < len(sql); {
		c := sql[i]
		switch {
		case c == '-' && at(sql, i+1) == '-' && (!syn.DashNeedsSpace || isSpaceOrEnd(sql, i+2)):
			i = lineEnd(sql, i)
		case c == '#' && syn.HashComments:
			i = lineEnd(sql, i)
		case c == '/' && at(sql, i+1) == '*':
			i = blockEnd(sql, i, syn.NestedComments)
		case c == '\'':
			i = quoteEnd(sql, i, '\'', syn.BackslashEscapes)
		case c == '"':
			i = quoteEnd(sql, i, '"', syn.BackslashEscapes)
		case c == '`':
			i = quoteEnd(sql, i, '`', false)
		case c == '[' && syn.Brackets:
			i = closeAt(sql, i+1, "]")
		case c == '$' && syn.DollarQuotes:
			i = dollarEnd(sql, i)
		case isWordStart(c):
			j := i + 1
			for j < len(sql) && isWordByte(sql[j]) {
				j++
			}
			w := strings.ToUpper(sql[i:j])
			if syn.EscapeStrings && w == "E" && at(sql, j) == '\'' {
				i = quoteEnd(sql, j, '\'', true)
				continue
			}
			settleEnd(w)
			words = append(words, w)
			if compound() {
				switch {
				case w == "BEGIN":
					depth++
				case w == "CASE" && depth > 0:
					depth++
				case w == "END" && depth > 0:
					pendingEnd = true
				}
			}
			i = j
		case c == '=':
			words = append(words, "=")
			i++
		case c == ';':
			settleEnd("")
			if depth <= 0 {
				flush(i)
			}
			i++
		default:
			i++
		}
	}
	flush(len(sql))
	return out
}

func classify(text string, words []string) Statement {
	has := func(targets ...string) bool {
		for _, t := range targets {
			if slices.Contains(words, t) {
				return true
			}
		}
		return false
	}
	hasSeq := func(a, b string) bool {
		for i := 0; i+1 < len(words); i++ {
			if words[i] == a && words[i+1] == b {
				return true
			}
		}
		return false
	}
	s := Statement{Text: text, words: words}
	switch words[0] {
	case "SELECT":
		into := has("INTO")
		locks := hasSeq("FOR", "UPDATE") || hasSeq("FOR", "SHARE") || hasSeq("FOR", "NO") ||
			hasSeq("FOR", "KEY") || hasSeq("LOCK", "IN")
		s.Write, s.Rows = into || locks, !into
	case "VALUES", "TABLE", "SHOW", "DESCRIBE", "DESC":
		s.Rows = true
	case "EXPLAIN": // EXPLAIN ANALYZE executes the statement
		s.Write, s.Rows = has("ANALYZE") && has("INSERT", "UPDATE", "DELETE", "MERGE", "INTO"), true
	case "PRAGMA": // PRAGMA name = value sets; anything else reads
		s.Write, s.Rows = has("="), true
	case "WITH":
		s.Write = has("INSERT", "UPDATE", "DELETE", "MERGE")
		s.Rows = !s.Write || has("RETURNING")
	case "INSERT", "UPDATE", "DELETE", "MERGE", "REPLACE", "UPSERT":
		s.Write, s.Rows = true, has("RETURNING")
	case "BEGIN", "START", "COMMIT", "END", "ROLLBACK", "SAVEPOINT", "RELEASE":
		// transaction control changes nothing by itself
	default:
		s.Write = true
	}
	return s
}

func at(s string, i int) byte {
	if i < len(s) {
		return s[i]
	}
	return 0
}

func isSpaceOrEnd(s string, i int) bool {
	c := at(s, i)
	return c == 0 || c == ' ' || c == '\t' || c == '\n' || c == '\r'
}

func isWordStart(c byte) bool {
	return c == '_' || c >= 0x80 || (c|0x20 >= 'a' && c|0x20 <= 'z')
}

func isWordByte(c byte) bool {
	return isWordStart(c) || (c >= '0' && c <= '9') || c == '$'
}

func lineEnd(s string, i int) int {
	if j := strings.IndexByte(s[i:], '\n'); j >= 0 {
		return i + j + 1
	}
	return len(s)
}

func closeAt(s string, from int, closer string) int {
	if j := strings.Index(s[from:], closer); j >= 0 {
		return from + j + len(closer)
	}
	return len(s)
}

func blockEnd(s string, i int, nested bool) int {
	if !nested {
		return closeAt(s, i+2, "*/")
	}
	depth := 0
	for j := i; j+1 < len(s); j++ {
		switch {
		case s[j] == '/' && s[j+1] == '*':
			depth++
			j++
		case s[j] == '*' && s[j+1] == '/':
			depth--
			j++
			if depth == 0 {
				return j + 1
			}
		}
	}
	return len(s)
}

// quoteEnd returns the index after the quote closing the one at i; a doubled
// quote is an escaped quote, as is a backslash-escaped one when escapes is set.
func quoteEnd(s string, i int, q byte, escapes bool) int {
	for j := i + 1; j < len(s); j++ {
		switch {
		case escapes && s[j] == '\\':
			j++
		case s[j] == q && at(s, j+1) == q:
			j++
		case s[j] == q:
			return j + 1
		}
	}
	return len(s)
}

// dollarEnd skips a $tag$...$tag$ string starting at i, or just the $ when
// it does not open one ($1 parameters, operators).
func dollarEnd(s string, i int) int {
	j := i + 1
	for j < len(s) && s[j] != '$' && isWordByte(s[j]) {
		if j == i+1 && s[j] >= '0' && s[j] <= '9' {
			return i + 1
		}
		j++
	}
	if j >= len(s) || s[j] != '$' {
		return i + 1
	}
	return closeAt(s, j+1, s[i:j+1])
}
