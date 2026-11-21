package api

import (
	"net/http"

	"github.com/knnedy/nexusql/internal/studio"
)

type exportResponse struct {
	Target string `json:"target"`
	Schema string `json:"schema"`
}

func (h *handler) handleExportPrisma(w http.ResponseWriter, r *http.Request) {
	h.export(w, r, studio.ExportPrisma)
}

func (h *handler) handleExportDrizzle(w http.ResponseWriter, r *http.Request) {
	h.export(w, r, studio.ExportDrizzle)
}

func (h *handler) export(w http.ResponseWriter, r *http.Request, target studio.ExportTarget) {
	out, err := h.studio.Export(r.Context(), target)
	if err != nil {
		writeServiceError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, exportResponse{
		Target: string(target),
		Schema: out,
	})
}
