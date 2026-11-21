package sqlite

import "strings"

type token struct {
	kind byte // 'w' word, 'i' quoted identifier, 's' string, else the punctuation itself
	text string
}

// allowedValues reads every CHECK (col IN (...)) constraint in a CREATE TABLE,
// keyed by lower-cased column (SQLite names ignore case); other shapes are ignored.
func allowedValues(createSQL string) map[string][]string {
	toks := tokenize(createSQL)
	out := map[string][]string{}
	for i := 0; i < len(toks); i++ {
		if toks[i].kind != 'w' || !strings.EqualFold(toks[i].text, "CHECK") || i+1 >= len(toks) || toks[i+1].kind != '(' {
			continue
		}
		end := closing(toks, i+1)
		if col, vals, ok := inList(toks[i+2 : end]); ok {
			out[strings.ToLower(col)] = vals
		}
		i = end
	}
	return out
}

// inList matches exactly: column IN ('a', 'b', ...), with optional outer parens.
func inList(t []token) (string, []string, bool) {
	for len(t) >= 2 && t[0].kind == '(' && closing(t, 0) == len(t)-1 {
		t = t[1 : len(t)-1]
	}
	if len(t) < 5 || (t[0].kind != 'w' && t[0].kind != 'i') || t[1].kind != 'w' ||
		!strings.EqualFold(t[1].text, "IN") || t[2].kind != '(' || t[len(t)-1].kind != ')' {
		return "", nil, false
	}
	var vals []string
	for j, tk := range t[3 : len(t)-1] {
		switch {
		case j%2 == 0 && tk.kind == 's':
			vals = append(vals, tk.text)
		case j%2 == 1 && tk.kind == ',':
		default:
			return "", nil, false
		}
	}
	if len(vals) == 0 || t[len(t)-2].kind != 's' {
		return "", nil, false
	}
	return t[0].text, vals, true
}

// closing returns the index of the parenthesis closing the one at open.
func closing(t []token, open int) int {
	depth := 0
	for j := open; j < len(t); j++ {
		switch t[j].kind {
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

func tokenize(s string) []token {
	var out []token
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
			text, next := quoted(s, i, c)
			kind := byte('i')
			if c == '\'' {
				kind = 's'
			}
			out, i = append(out, token{kind, text}), next
		case c == '[':
			j := strings.IndexByte(s[i:], ']')
			if j < 0 {
				j = len(s) - i - 1
			}
			out, i = append(out, token{'i', s[i+1 : i+j]}), i+j+1
		case c == '_' || c >= 0x80 || (c|0x20 >= 'a' && c|0x20 <= 'z') || (c >= '0' && c <= '9'):
			j := i + 1
			for j < len(s) && (s[j] == '_' || s[j] == '$' || s[j] >= 0x80 ||
				(s[j]|0x20 >= 'a' && s[j]|0x20 <= 'z') || (s[j] >= '0' && s[j] <= '9')) {
				j++
			}
			out, i = append(out, token{'w', s[i:j]}), j
		case c == ' ' || c == '\t' || c == '\n' || c == '\r':
			i++
		default:
			out, i = append(out, token{c, string(c)}), i+1
		}
	}
	return out
}

// quoted reads the quoted text starting at i, where a doubled quote is one quote.
func quoted(s string, i int, q byte) (string, int) {
	var b strings.Builder
	for j := i + 1; j < len(s); j++ {
		if s[j] == q {
			if j+1 < len(s) && s[j+1] == q {
				b.WriteByte(q)
				j++
				continue
			}
			return b.String(), j + 1
		}
		b.WriteByte(s[j])
	}
	return b.String(), len(s)
}
