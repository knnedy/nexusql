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
	h.export(w, r, "prisma", db.Exporter.Prisma)
}

func (h *handler) handleExportDrizzle(w http.ResponseWriter, r *http.Request) {
	h.export(w, r, "drizzle", db.Exporter.Drizzle)
}

func (h *handler) export(w http.ResponseWriter, r *http.Request, target string, render func(db.Exporter, *db.Schema) string) {
	conn, err := h.session.Get()
	if err == session.ErrNoActiveConnection {
		writeError(w, http.StatusUnauthorized, err.Error())
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	schema, err := conn.Impl.IntrospectSchema(r.Context(), conn.Impl.DefaultSchema())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	exp, err := db.ExporterFor(conn.Kind)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, exportResponse{
		Target: target,
		Schema: render(exp, schema),
	})
}
