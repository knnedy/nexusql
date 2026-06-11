package api

import (
	"net/http"

	"github.com/knnedy/nexusql/internal/db"
	"github.com/knnedy/nexusql/internal/session"
)

type exportResponse struct {
	Target string `json:"target"`
	Schema string `json:"schema"`
}

func (h *handler) handleExportPrisma(w http.ResponseWriter, r *http.Request) {
	conn, err := h.session.Get()
	if err == session.ErrNoActiveConnection {
		writeError(w, http.StatusUnauthorized, err.Error())
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	schema, err := db.IntrospectSchema(r.Context(), conn, "public")
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, exportResponse{
		Target: "prisma",
		Schema: db.GeneratePrisma(schema),
	})
}

func (h *handler) handleExportDrizzle(w http.ResponseWriter, r *http.Request) {
	conn, err := h.session.Get()
	if err == session.ErrNoActiveConnection {
		writeError(w, http.StatusUnauthorized, err.Error())
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	schema, err := db.IntrospectSchema(r.Context(), conn, "public")
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, exportResponse{
		Target: "drizzle",
		Schema: db.GenerateDrizzle(schema),
	})
}
