package api

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/knnedy/nexusql/internal/db"
	"github.com/knnedy/nexusql/internal/session"
)

type rowsResponse struct {
	TableName string           `json:"tableName"`
	Columns   []string         `json:"columns"`
	Rows      []map[string]any `json:"rows"`
	Total     int64            `json:"total"`
	Page      int              `json:"page"`
	PageSize  int              `json:"pageSize"`
}

func (h *handler) handleRows(w http.ResponseWriter, r *http.Request) {
	conn, err := h.session.Get()
	if err == session.ErrNoActiveConnection {
		writeError(w, http.StatusUnauthorized, err.Error())
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	tableName := chi.URLParam(r, "tableName")
	if tableName == "" {
		writeError(w, http.StatusBadRequest, "tableName is required")
		return
	}

	pageSize := 50
	page := 1

	if ps := r.URL.Query().Get("pageSize"); ps != "" {
		if v, err := strconv.Atoi(ps); err == nil && v > 0 && v <= 500 {
			pageSize = v
		}
	}

	if p := r.URL.Query().Get("page"); p != "" {
		if v, err := strconv.Atoi(p); err == nil && v > 0 {
			page = v
		}
	}

	offset := (page - 1) * pageSize

	columns, rows, total, err := db.FetchRows(r.Context(), conn, tableName, pageSize, offset)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, rowsResponse{
		TableName: tableName,
		Columns:   columns,
		Rows:      rows,
		Total:     total,
		Page:      page,
		PageSize:  pageSize,
	})
}
