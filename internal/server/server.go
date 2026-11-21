// Package server assembles the HTTP handler tree and runs it until shutdown.
package server

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/knnedy/nexusql/internal/api"
	"github.com/knnedy/nexusql/internal/db"
	"github.com/knnedy/nexusql/internal/projects"
	"github.com/knnedy/nexusql/internal/session"
	"github.com/knnedy/nexusql/internal/studio"
	"github.com/knnedy/nexusql/internal/ui"
)

const shutdownTimeout = 10 * time.Second

// Options holds everything the server needs from main.
type Options struct {
	Addr     string
	IsDev    bool
	Version  string
	Token    string // non-empty when exposed; required on every request
	Session  *session.Store
	Projects projects.Store
	// QueryTimeout bounds each database statement; 0 uses studio's default.
	QueryTimeout time.Duration
	Files        db.Options // which database files connections may open
}

// Server is the HTTP server plus the database session it closes on exit.
type Server struct {
	*http.Server
	session *session.Store
}

// New builds the server: the JSON API under /api, the embedded UI everywhere else.
func New(o Options) *Server {
	r := chi.NewRouter()
	r.Use(guard(o))
	r.Mount("/api", api.Router(studio.New(o.Session, o.Projects, studio.Config{QueryTimeout: o.QueryTimeout, Files: o.Files}), api.Config{IsDev: o.IsDev, Version: o.Version}))
	r.Handle("/*", ui.Handler())

	queryTimeout := o.QueryTimeout
	if queryTimeout <= 0 {
		queryTimeout = studio.DefaultQueryTimeout
	}
	srv := &http.Server{
		Addr:        o.Addr,
		Handler:     r,
		ReadTimeout: 15 * time.Second,
		// Room for a statement to hit its own timeout and still report it.
		WriteTimeout: queryTimeout + 15*time.Second,
		IdleTimeout:  60 * time.Second,
	}
	return &Server{Server: srv, session: o.Session}
}

// Run serves until ctx is cancelled, then shuts down gracefully.
func Run(ctx context.Context, srv *Server) error {
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
	err := srv.Shutdown(shutdownCtx) // waits for in-flight requests
	srv.session.Clear()              // then closes the database pool
	return err
}
