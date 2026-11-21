// Package ui embeds the statically exported frontend built from web/.
package ui

import (
	"embed"
	"io/fs"
	"net/http"
)

// dist holds web/out copied in by `make web-build`; only .gitkeep is committed.
//
//go:embed all:dist
var dist embed.FS

const notBuiltPage = `<!doctype html>
<meta charset="utf-8">
<title>NexusQL</title>
<body style="font-family:system-ui,sans-serif;max-width:40rem;margin:4rem auto;padding:0 1rem">
<h1>Frontend not built</h1>
<p>This binary was compiled without the web UI. Run <code>make build</code>,
or <code>make dev</code> and open <a href="http://localhost:3000">localhost:3000</a>.</p>
</body>`

// Handler serves the embedded frontend, or a build hint if it was not embedded.
func Handler() http.Handler {
	sub, err := fs.Sub(dist, "dist")
	if err != nil {
		panic(err) // "dist" is a fixed embed path; failure is a build bug
	}
	if _, err := fs.Stat(sub, "index.html"); err != nil {
		return http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.WriteHeader(http.StatusServiceUnavailable)
			_, _ = w.Write([]byte(notBuiltPage))
		})
	}
	return http.FileServer(http.FS(sub))
}
