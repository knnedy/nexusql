package api

import (
	"net/http"

	"github.com/knnedy/nexusql/internal/db"
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
	conn, ok := h.activeConn(w)
	if !ok {
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
