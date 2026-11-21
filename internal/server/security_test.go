package server_test

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/knnedy/nexusql/internal/projects"
	"github.com/knnedy/nexusql/internal/server"
	"github.com/knnedy/nexusql/internal/session"
)

const token = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

func handler(t *testing.T, opts server.Options) http.Handler {
	t.Helper()
	t.Setenv("HOME", t.TempDir())
	proj, err := projects.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	opts.Session, opts.Projects = session.NewStore(), proj
	if opts.Addr == "" {
		opts.Addr = "127.0.0.1:7080"
	}
	return server.New(opts).Handler
}

func do(h http.Handler, method, target string, headers map[string]string) *httptest.ResponseRecorder {
	r := httptest.NewRequest(method, target, nil)
	r.Host = "127.0.0.1:7080"
	for k, v := range headers {
		if k == "Host" {
			r.Host = v
			continue
		}
		r.Header.Set(k, v)
	}
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	return w
}

func TestHostAllowlist(t *testing.T) {
	h := handler(t, server.Options{})
	for host, want := range map[string]int{
		"127.0.0.1:7080":   http.StatusOK,
		"localhost:7080":   http.StatusOK,
		"[::1]:7080":       http.StatusOK,
		"evil.com:7080":    http.StatusForbidden, // DNS rebinding
		"192.168.1.5:7080": http.StatusForbidden,
	} {
		if got := do(h, "GET", "/api/health", map[string]string{"Host": host}).Code; got != want {
			t.Errorf("Host %s: status %d, want %d", host, got, want)
		}
	}
}

func TestOriginCheckOnStateChangingRequests(t *testing.T) {
	cases := []struct {
		name   string
		dev    bool
		origin string
		block  bool
	}{
		{"same origin", false, "http://127.0.0.1:7080", false},
		{"no Origin header (curl)", false, "", false},
		{"foreign site", false, "https://evil.com", true},
		{"dev server outside dev mode", false, "http://localhost:3000", true},
		{"dev server in dev mode", true, "http://localhost:3000", false},
		{"null origin", false, "null", true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			h := handler(t, server.Options{IsDev: c.dev})
			headers := map[string]string{}
			if c.origin != "" {
				headers["Origin"] = c.origin
			}
			got := do(h, "POST", "/api/disconnect", headers).Code
			if blocked := got == http.StatusForbidden; blocked != c.block {
				t.Fatalf("status %d, want blocked=%v", got, c.block)
			}
		})
	}
}

func TestTokenRequiredWhenExposed(t *testing.T) {
	h := handler(t, server.Options{Token: token, Addr: "0.0.0.0:7080"})
	lan := map[string]string{"Host": "192.168.1.5:7080"}

	t.Run("rejects requests without a token", func(t *testing.T) {
		if got := do(h, "GET", "/api/health", lan).Code; got != http.StatusUnauthorized {
			t.Fatalf("status %d, want 401", got)
		}
		if got := do(h, "GET", "/", lan).Code; got != http.StatusUnauthorized {
			t.Fatalf("UI status %d, want 401", got)
		}
	})

	t.Run("rejects a wrong token", func(t *testing.T) {
		hdr := map[string]string{"Host": lan["Host"], "Authorization": "Bearer " + strings.Repeat("0", 64)}
		if got := do(h, "GET", "/api/health", hdr).Code; got != http.StatusUnauthorized {
			t.Fatalf("status %d, want 401", got)
		}
	})

	t.Run("accepts a bearer token or the cookie", func(t *testing.T) {
		for _, hdr := range []map[string]string{
			{"Host": lan["Host"], "Authorization": "Bearer " + token},
			{"Host": lan["Host"], "Cookie": "nexusql_token=" + token},
		} {
			if got := do(h, "GET", "/api/health", hdr).Code; got != http.StatusOK {
				t.Fatalf("headers %v: status %d, want 200", hdr, got)
			}
		}
	})

	t.Run("token link sets an HttpOnly cookie and drops the token from the URL", func(t *testing.T) {
		w := do(h, "GET", "/studio/?token="+token+"&x=1", lan)
		if w.Code != http.StatusSeeOther || w.Header().Get("Location") != "/studio/?x=1" {
			t.Fatalf("status %d location %q, want 303 to /studio/?x=1", w.Code, w.Header().Get("Location"))
		}
		c := w.Result().Cookies()
		if len(c) != 1 || c[0].Name != "nexusql_token" || c[0].Value != token || !c[0].HttpOnly ||
			c[0].SameSite != http.SameSiteStrictMode {
			t.Fatalf("cookies %+v, want HttpOnly SameSite=Strict nexusql_token", c)
		}
	})
}
