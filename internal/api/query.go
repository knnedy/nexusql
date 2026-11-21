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
	Statements           int              `json:"statements"`
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

	// Never null: the console reads columns and rows on every result.
	if res.Columns == nil {
		res.Columns = []string{}
	}
	if res.Rows == nil {
		res.Rows = []map[string]any{}
	}
	writeJSON(w, http.StatusOK, queryResponse{
		Columns:              res.Columns,
		Rows:                 res.Rows,
		RowsAffected:         res.RowsAffected,
		IsWrite:              res.IsWrite,
		Truncated:            res.Truncated,
		Statements:           res.Statements,
		RequiresConfirmation: res.RequiresConfirmation,
	})
}
