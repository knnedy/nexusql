package api

import (
	"net/http"

	"github.com/knnedy/nexusql/internal/db"
)

type schemaResponse struct {
	Tables    []db.Table    `json:"tables"`
	Relations []db.Relation `json:"relations"`
	Enums     []db.EnumType `json:"enums"`
}

func (h *handler) handleSchema(w http.ResponseWriter, r *http.Request) {
	result, err := h.studio.Schema(r.Context(), r.URL.Query().Get("schema"))
	if err != nil {
		writeServiceError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, schemaResponse{
		Tables:    result.Tables,
		Relations: result.Relations,
		Enums:     result.Enums,
	})
}
