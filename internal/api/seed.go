package api

import (
	"net/http"

	"github.com/knnedy/nexusql/internal/seed"
)

type seedRequest struct {
	RowsPerTable int     `json:"rowsPerTable"`
	NullChance   float64 `json:"nullChance"`
	// Tables, when set, seeds only these, each with its own row count.
	Tables map[string]int `json:"tables"`
}

type seedSampleRequest struct {
	Table      string  `json:"table"`
	Rows       int     `json:"rows"`
	NullChance float64 `json:"nullChance"`
}

type seedResponse struct {
	RowsInserted map[string]int    `json:"rowsInserted"`
	Skipped      map[string]int    `json:"skipped"`  // rows the database rejected on every try
	Problems     map[string]string `json:"problems"` // why a table's last row was rejected
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
		Tables:       req.Tables,
	})
	if err != nil {
		writeServiceError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, seedResponse{
		RowsInserted: result.RowsInserted, Skipped: result.Skipped, Problems: result.Problems,
	})
}

func (h *handler) handleSeedSample(w http.ResponseWriter, r *http.Request) {
	var req seedSampleRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	if req.Rows <= 0 {
		req.Rows = 3
	}
	if req.NullChance < 0 || req.NullChance > 1 {
		req.NullChance = 0.2
	}
	sample, err := h.studio.SeedSample(r.Context(), req.Table, req.Rows, req.NullChance)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, sample)
}
