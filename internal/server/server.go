// Package server assembles the HTTP handler tree and runs it until shutdown.
package server

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/knnedy/nexusql/internal/api"
	"github.com/knnedy/nexusql/internal/projects"
	"github.com/knnedy/nexusql/internal/session"
	"github.com/knnedy/nexusql/internal/ui"
)

const shutdownTimeout = 10 * time.Second

// Options holds everything the server needs from main.
type Options struct {
	Addr     string
	IsDev    bool
	Version  string
	Session  *session.Store
	Projects projects.Store
}

// New builds the server: the JSON API under /api, the embedded UI everywhere else.
func New(o Options) *http.Server {
	r := chi.NewRouter()
	r.Mount("/api", api.Router(o.Session, o.Projects, api.Config{IsDev: o.IsDev, Version: o.Version}))
	r.Handle("/*", ui.Handler())

	return &http.Server{
		Addr:         o.Addr,
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}
}

// Run serves until ctx is cancelled, then shuts down gracefully.
func Run(ctx context.Context, srv *http.Server) error {
	errc := make(chan error, 1)
	go func() { errc <- srv.ListenAndServe() }()

	select {
	case err := <-errc:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return err
	case <-ctx.Done():
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()
	return srv.Shutdown(shutdownCtx)
}
