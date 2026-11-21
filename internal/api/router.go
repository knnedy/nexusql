package api

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/knnedy/nexusql/internal/studio"
)

// Config carries build- and run-time settings the API needs.
type Config struct {
	IsDev   bool
	Version string
}

type handler struct {
	studio  *studio.Service
	version string
}

// Router returns the JSON API; mount it under /api.
func Router(svc *studio.Service, cfg Config) *chi.Mux {
	h := &handler{
		studio:  svc,
		version: cfg.Version,
	}

	r := chi.NewRouter()
	r.Use(middleware.NoCache)

	if cfg.IsDev {
		r.Use(cors.Handler(cors.Options{
			AllowedOrigins:   []string{"http://localhost:3000", "http://127.0.0.1:3000"},
			AllowedMethods:   []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete, http.MethodOptions},
			AllowedHeaders:   []string{"Content-Type"},
			AllowCredentials: false,
			MaxAge:           300,
		}))
	}

	// Health
	r.Get("/health", h.handleHealth)

	// Connection lifecycle
	r.Post("/connect", h.handleConnect)
	r.Post("/disconnect", h.handleDisconnect)
	r.Get("/connection/read-only", h.handleGetReadOnly)
	r.Put("/connection/read-only", h.handleSetReadOnly)

	// Schema
	r.Get("/schema", h.handleSchema)

	// Rows
	r.Get("/rows/{tableName}", h.handleRows)
	r.Get("/rows/{tableName}/lookup", h.handleRowLookup)
	r.Patch("/rows/{tableName}", h.handleUpdateRow)

	// SQL console
	r.Post("/query", h.handleQuery)

	// Seed data
	r.Post("/seed", h.handleSeed)

	// Schema export
	r.Get("/export/prisma", h.handleExportPrisma)
	r.Get("/export/drizzle", h.handleExportDrizzle)

	// Projects
	r.Get("/projects", h.handleListProjects)
	r.Post("/projects", h.handleCreateProject)
	r.Patch("/projects/{id}", h.handleRenameProject)
	r.Delete("/projects/{id}", h.handleDeleteProject)
	r.Patch("/projects/{id}/opened", h.handleTouchProject)

	return r
}
