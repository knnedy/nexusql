package api

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/knnedy/nexusql/internal/projects"
	"github.com/knnedy/nexusql/internal/session"
)

type handler struct {
	session  *session.Store
	projects projects.Store
}

func Router(sess *session.Store, proj projects.Store, isDev bool) *chi.Mux {
	h := &handler{
		session:  sess,
		projects: proj,
	}

	r := chi.NewRouter()
	r.Use(middleware.NoCache)

	if isDev {
		r.Use(cors.Handler(cors.Options{
			AllowedOrigins:   []string{"http://localhost:3000", "http://127.0.0.1:3000"},
			AllowedMethods:   []string{http.MethodGet, http.MethodPost, http.MethodPatch, http.MethodDelete, http.MethodOptions},
			AllowedHeaders:   []string{"Content-Type"},
			AllowCredentials: false,
			MaxAge:           300,
		}))
	}

	r.Get("/health", h.handleHealth)

	r.Post("/connect", h.handleConnect)
	r.Post("/disconnect", h.handleDisconnect)

	r.Get("/schema", h.handleSchema)

	r.Get("/rows/{tableName}", h.handleRows)
	r.Get("/rows/{tableName}/lookup", h.handleRowLookup)
	r.Patch("/rows/{tableName}", h.handleUpdateRow)

	r.Get("/export/prisma", h.handleExportPrisma)
	r.Get("/export/drizzle", h.handleExportDrizzle)

	r.Get("/projects", h.handleListProjects)
	r.Post("/projects", h.handleCreateProject)
	r.Patch("/projects/{id}", h.handleRenameProject)
	r.Delete("/projects/{id}", h.handleDeleteProject)
	r.Patch("/projects/{id}/opened", h.handleTouchProject)

	return r
}
