package api

import (
	"net/http"

	"github.com/knnedy/nexusql/internal/db"
	"github.com/knnedy/nexusql/internal/session"
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
	RequiresConfirmation bool             `json:"requiresConfirmation"`
}

func (h *handler) handleQuery(w http.ResponseWriter, r *http.Request) {
	conn, err := h.session.Get()
	if err == session.ErrNoActiveConnection {
		writeError(w, http.StatusUnauthorized, err.Error())
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	var req queryRequest
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.SQL == "" {
		writeError(w, http.StatusBadRequest, "sql is required")
		return
	}

	if db.IsDestructiveQuery(req.SQL) && !req.Confirmed {
		writeJSON(w, http.StatusOK, queryResponse{
			RequiresConfirmation: true,
		})
		return
	}

	columns, rows, rowsAffected, isWrite, err := conn.Impl.ExecuteQuery(r.Context(), req.SQL)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, queryResponse{
		Columns:      columns,
		Rows:         rows,
		RowsAffected: rowsAffected,
		IsWrite:      isWrite,
	})
}
