package db

import (
	"net/url"
	"regexp"
	"strings"
)

const mask = "****"

// placeholder survives url escaping (unlike "*") and is swapped for mask afterwards.
const placeholder = "NEXUSQLREDACTEDPASSWORD"

var schemeRe = regexp.MustCompile(`^[A-Za-z][A-Za-z0-9+.-]*$`)

var secretParams = map[string]bool{"password": true, "pass": true, "pwd": true}

// RedactURI masks passwords in a connection URI so it is safe to show or log.
// Anything it cannot parse is replaced entirely rather than echoed.
func RedactURI(uri string) string {
	scheme, _, ok := strings.Cut(uri, "://")
	if !ok || !schemeRe.MatchString(scheme) {
		return "[unrecognised connection string]"
	}
	u, err := url.Parse(uri)
	if err != nil {
		return scheme + "://[unparseable]"
	}
	if _, has := u.User.Password(); has {
		u.User = url.UserPassword(u.User.Username(), placeholder)
	}
	if u.RawQuery != "" {
		parts := strings.Split(u.RawQuery, "&")
		for i, p := range parts {
			if k, _, found := strings.Cut(p, "="); found && secretParams[strings.ToLower(k)] {
				parts[i] = k + "=" + mask
			}
		}
		u.RawQuery = strings.Join(parts, "&")
	}
	return strings.Replace(u.String(), placeholder, mask, 1)
}
