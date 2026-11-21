package api

import (
	"net/http"

	"github.com/knnedy/nexusql/internal/seed"
)

type seedRequest struct {
	RowsPerTable int     `json:"rowsPerTable"`
	NullChance   float64 `json:"nullChance"`
}

type seedResponse struct {
	RowsInserted map[string]int `json:"rowsInserted"`
}

func (h *handler) handleSeed(w http.ResponseWriter, r *http.Request) {
	var req seedRequest
	if !decodeJSON(w, r, &req) {
		return
	}

	if req.RowsPerTable <= 0 {
		req.RowsPerTable = 10
	}
	if req.NullChance < 0 || req.NullChance > 1 {
		req.NullChance = 0.2
	}

	result, err := h.studio.Seed(r.Context(), seed.Options{
		RowsPerTable: req.RowsPerTable,
		NullChance:   req.NullChance,
	})
	if err != nil {
		writeServiceError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, seedResponse{RowsInserted: result.RowsInserted})
}
