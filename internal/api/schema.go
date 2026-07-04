package api

import (
	"net/http"

	"github.com/knnedy/nexusql/internal/db"
	"github.com/knnedy/nexusql/internal/session"
)

type schemaResponse struct {
	Tables    []db.Table    `json:"tables"`
	Relations []db.Relation `json:"relations"`
	Enums     []db.EnumType `json:"enums"`
}

func (h *handler) handleSchema(w http.ResponseWriter, r *http.Request) {
	conn, err := h.session.Get()
	if err == session.ErrNoActiveConnection {
		writeError(w, http.StatusUnauthorized, err.Error())
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	schema := r.URL.Query().Get("schema")
	if schema == "" {
		schema = "public"
	}

	result, err := db.IntrospectSchema(r.Context(), conn, schema)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, schemaResponse{
		Tables:    result.Tables,
		Relations: result.Relations,
		Enums:     result.Enums,
	})
}
