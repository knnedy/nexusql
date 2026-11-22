package db

import (
	"strings"

	"github.com/knnedy/nexusql/internal/sqlscan"
)

// Token is one lexical token of a SQL expression.
type Token struct {
	Kind     byte // 'w' word, 'i' quoted identifier, 's' string, else the punctuation itself
	Text     string
	Pos, End int // byte offsets of the token in the source
}

// IsWord reports whether t is the keyword w, ignoring case.
func (t Token) IsWord(w string) bool { return t.Kind == 'w' && strings.EqualFold(t.Text, w) }

// AllowedIn matches a CHECK body listing string values: col IN ('a', ...) or
// col = 'a', with optional outer parens. Dialects strip their own syntax first.
func AllowedIn(t []Token) (string, []string, bool) {
	for len(t) >= 2 && t[0].Kind == '(' && Closing(t, 0) == len(t)-1 {
		t = t[1 : len(t)-1]
	}
	if len(t) < 3 || (t[0].Kind != 'w' && t[0].Kind != 'i') {
		return "", nil, false
	}
	if len(t) == 3 && t[1].Kind == '=' && t[2].Kind == 's' {
		return t[0].Text, []string{t[2].Text}, true
	}
	if len(t) < 5 || !t[1].IsWord("IN") || t[2].Kind != '(' || Closing(t, 2) != len(t)-1 {
		return "", nil, false
	}
	var vals []string
	for j, tk := range t[3 : len(t)-1] {
		switch {
		case j%2 == 0 && tk.Kind == 's':
			vals = append(vals, tk.Text)
		case j%2 == 1 && tk.Kind == ',':
		default:
			return "", nil, false
		}
	}
	if len(vals) == 0 || t[len(t)-2].Kind != 's' {
		return "", nil, false
	}
	return t[0].Text, vals, true
}

// Closing returns the index of the parenthesis closing the one at open.
func Closing(t []Token, open int) int {
	depth := 0
	for j := open; j < len(t); j++ {
		switch t[j].Kind {
		case '(':
			depth++
		case ')':
			if depth--; depth == 0 {
				return j
			}
		}
	}
	return len(t) - 1
}

// Tokenize splits s into tokens, dropping comments; syn gives the dialect's
// bracket identifiers and backslash escapes.
func Tokenize(s string, syn sqlscan.Syntax) []Token {
	var out []Token
	for i := 0; i < len(s); {
		c := s[i]
		switch {
		case c == '-' && i+1 < len(s) && s[i+1] == '-':
			for i < len(s) && s[i] != '\n' {
				i++
			}
		case c == '/' && i+1 < len(s) && s[i+1] == '*':
			if j := strings.Index(s[i+2:], "*/"); j >= 0 {
				i += j + 4
			} else {
				i = len(s)
			}
		case c == '\'' || c == '"' || c == '`':
			text, next := quoted(s, i, c, c == '\'' && syn.BackslashEscapes)
			kind := byte('i')
			if c == '\'' {
				kind = 's'
			}
			out, i = append(out, Token{kind, text, i, next}), next
		case c == '[' && syn.Brackets:
			j := strings.IndexByte(s[i:], ']')
			if j < 0 {
				j = len(s) - i - 1
			}
			out, i = append(out, Token{'i', s[i+1 : i+j], i, i + j + 1}), i+j+1
		case c == '_' || c >= 0x80 || (c|0x20 >= 'a' && c|0x20 <= 'z') || (c >= '0' && c <= '9'):
			j := i + 1
			for j < len(s) && (s[j] == '_' || s[j] == '$' || s[j] >= 0x80 ||
				(s[j]|0x20 >= 'a' && s[j]|0x20 <= 'z') || (s[j] >= '0' && s[j] <= '9')) {
				j++
			}
			out, i = append(out, Token{'w', s[i:j], i, j}), j
		case c == ' ' || c == '\t' || c == '\n' || c == '\r':
			i++
		default:
			out, i = append(out, Token{c, string(c), i, i + 1}), i+1
		}
	}
	return out
}

// quoted reads the quoted text starting at i, where a doubled quote is one
// quote and, with backslashes, \x is x.
func quoted(s string, i int, q byte, backslashes bool) (string, int) {
	var b strings.Builder
	for j := i + 1; j < len(s); j++ {
		switch {
		case backslashes && s[j] == '\\' && j+1 < len(s):
			b.WriteByte(s[j+1])
			j++
		case s[j] == q && j+1 < len(s) && s[j+1] == q:
			b.WriteByte(q)
			j++
		case s[j] == q:
			return b.String(), j + 1
		default:
			b.WriteByte(s[j])
		}
	}
	return b.String(), len(s)
}
