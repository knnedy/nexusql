package api

import (
	"net/http"

	"github.com/knnedy/nexusql/internal/db"
	"github.com/knnedy/nexusql/internal/session"
)

type seedRequest struct {
	RowsPerTable int     `json:"rowsPerTable"`
	NullChance   float64 `json:"nullChance"`
}

type seedResponse struct {
	RowsInserted map[string]int `json:"rowsInserted"`
}

func (h *handler) handleSeed(w http.ResponseWriter, r *http.Request) {
	conn, err := h.session.Get()
	if err == session.ErrNoActiveConnection {
		writeError(w, http.StatusUnauthorized, err.Error())
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	var req seedRequest
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.RowsPerTable <= 0 {
		req.RowsPerTable = 10
	}
	if req.NullChance < 0 || req.NullChance > 1 {
		req.NullChance = 0.2
	}

	schema, err := conn.Impl.IntrospectSchema(r.Context(), "public")
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	result, err := db.RunSeed(r.Context(), conn.Impl, schema, db.SeedOptions{
		RowsPerTable: req.RowsPerTable,
		NullChance:   req.NullChance,
	})
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, seedResponse{RowsInserted: result.RowsInserted})
}
