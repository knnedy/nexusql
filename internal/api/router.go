package api

import (
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/knnedy/nexusql/internal/projects"
	"github.com/knnedy/nexusql/internal/session"
)

type handler struct {
	session  *session.Store
	projects projects.Store
}

func Router(sess *session.Store, proj projects.Store) *chi.Mux {
	h := &handler{
		session:  sess,
		projects: proj,
	}

	r := chi.NewRouter()
	r.Use(middleware.NoCache)

	r.Get("/health", h.handleHealth)

	r.Post("/connect", h.handleConnect)
	r.Post("/disconnect", h.handleDisconnect)

	r.Get("/schema", h.handleSchema)

	r.Get("/projects", h.handleListProjects)
	r.Post("/projects", h.handleCreateProject)
	r.Delete("/projects/{id}", h.handleDeleteProject)

	return r
}
