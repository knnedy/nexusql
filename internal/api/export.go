package api

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/knnedy/nexusql/internal/studio"
)

type exportFormatsResponse struct {
	Formats []studio.ExportFormat `json:"formats"`
}

type exportResponse struct {
	Format string `json:"format"`
	Schema string `json:"schema"`
}

func (h *handler) handleExportFormats(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, exportFormatsResponse{Formats: h.studio.ExportFormats()})
}

func (h *handler) handleExport(w http.ResponseWriter, r *http.Request) {
	format := chi.URLParam(r, "format")
	out, err := h.studio.Export(r.Context(), format, r.URL.Query()["tables"])
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, exportResponse{Format: format, Schema: out})
}

type tableDDLResponse struct {
	DDL string `json:"ddl"`
}

func (h *handler) handleTableDDL(w http.ResponseWriter, r *http.Request) {
	ddl, err := h.studio.TableDDL(r.Context(), chi.URLParam(r, "tableName"))
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, tableDDLResponse{DDL: ddl})
}
