package server

import (
	"crypto/subtle"
	"net"
	"net/http"
	"strings"

	"github.com/knnedy/nexusql/internal/config"
)

const tokenCookie = "nexusql_token"

// devOrigins is the Next.js dev server, allowed to call the API in dev mode.
var devOrigins = map[string]bool{
	"http://localhost:3000": true,
	"http://127.0.0.1:3000": true,
}

// guard blocks DNS rebinding (Host), cross-site writes (Origin) and, when
// exposed, any request without the access token.
func guard(o Options) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if o.Token == "" && !config.IsLoopback(hostname(r.Host)) {
				http.Error(w, "forbidden host", http.StatusForbidden)
				return
			}
			if o.Token != "" && !authorized(w, r, o.Token) {
				return
			}
			if !originAllowed(r, o.IsDev) {
				http.Error(w, "cross-origin request blocked", http.StatusForbidden)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// authorized checks the token; a ?token= link is swapped for a cookie and a redirect.
func authorized(w http.ResponseWriter, r *http.Request, token string) bool {
	q := r.URL.Query()
	if t := q.Get("token"); t != "" {
		if !equal(t, token) {
			http.Error(w, "invalid access token", http.StatusUnauthorized)
			return false
		}
		http.SetCookie(w, &http.Cookie{
			Name: tokenCookie, Value: token, Path: "/",
			HttpOnly: true, SameSite: http.SameSiteStrictMode,
		})
		q.Del("token")
		u := *r.URL
		u.RawQuery = q.Encode()
		http.Redirect(w, r, u.RequestURI(), http.StatusSeeOther)
		return false
	}

	if bearer, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer "); ok && equal(bearer, token) {
		return true
	}
	if c, err := r.Cookie(tokenCookie); err == nil && equal(c.Value, token) {
		return true
	}
	http.Error(w, "access token required: open the URL printed by nexusql", http.StatusUnauthorized)
	return false
}

// originAllowed rejects state-changing requests sent by another site.
func originAllowed(r *http.Request, isDev bool) bool {
	switch r.Method {
	case http.MethodGet, http.MethodHead, http.MethodOptions:
		return true
	}
	origin := r.Header.Get("Origin")
	if origin == "" {
		return true // not a browser cross-origin request (curl, scripts)
	}
	if origin == "http://"+r.Host || origin == "https://"+r.Host {
		return true
	}
	return isDev && devOrigins[origin]
}

func hostname(hostport string) string {
	if h, _, err := net.SplitHostPort(hostport); err == nil {
		return strings.ToLower(h)
	}
	return strings.ToLower(strings.Trim(hostport, "[]"))
}

func equal(a, b string) bool {
	return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}
