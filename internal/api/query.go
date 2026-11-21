package api

import (
	"net/http"
)

type queryRequest struct {
	SQL       string `json:"sql"`
	Confirmed bool   `json:"confirmed"`
}

type queryResponse struct {
	Columns              []string         `json:"columns"`
	Rows                 []map[string]any `json:"rows"`
	RowsAffected         int64            `json:"rowsAffected"`
	IsWrite              bool             `json:"isWrite"`
	Truncated            bool             `json:"truncated"`
	RequiresConfirmation bool             `json:"requiresConfirmation"`
}

func (h *handler) handleQuery(w http.ResponseWriter, r *http.Request) {
	var req queryRequest
	if !decodeJSON(w, r, &req) {
		return
	}

	res, err := h.studio.Query(r.Context(), req.SQL, req.Confirmed)
	if err != nil {
		writeServiceError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, queryResponse{
		Columns:              res.Columns,
		Rows:                 res.Rows,
		RowsAffected:         res.RowsAffected,
		IsWrite:              res.IsWrite,
		Truncated:            res.Truncated,
		RequiresConfirmation: res.RequiresConfirmation,
	})
}
