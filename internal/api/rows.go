package api

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/knnedy/nexusql/internal/db"
	"github.com/knnedy/nexusql/internal/studio"
)

type rowsResponse struct {
	TableName string           `json:"tableName"`
	Columns   []string         `json:"columns"`
	Rows      []map[string]any `json:"rows"`
	Total     int64            `json:"total"`
	Page      int              `json:"page"`
	PageSize  int              `json:"pageSize"`
	SortCol   string           `json:"sortCol"`
	SortDir   string           `json:"sortDir"`
	Search    string           `json:"search"`
}

type lookupResponse struct {
	TableName string           `json:"tableName"`
	Field     string           `json:"field"`
	Value     string           `json:"value"`
	Columns   []string         `json:"columns"`
	Rows      []map[string]any `json:"rows"`
}

type updateRowRequest struct {
	PKField     string `json:"pkField"`
	PKValue     string `json:"pkValue"`
	TargetField string `json:"targetField"`
	NewValue    string `json:"newValue"`
}

func (h *handler) handleRows(w http.ResponseWriter, r *http.Request) {
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

	sortDir := db.SortAsc
	if r.URL.Query().Get("dir") == "desc" {
		sortDir = db.SortDesc
	}

	q := studio.RowsQuery{
		Table:   tableName,
		Limit:   pageSize,
		Offset:  (page - 1) * pageSize,
		SortCol: r.URL.Query().Get("sort"),
		SortDir: sortDir,
		Search:  r.URL.Query().Get("search"),
	}

	res, err := h.studio.Rows(r.Context(), q)
	if err != nil {
		writeServiceError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, rowsResponse{
		TableName: tableName,
		Columns:   res.Columns,
		Rows:      res.Rows,
		Total:     res.Total,
		Page:      page,
		PageSize:  pageSize,
		SortCol:   q.SortCol,
		SortDir:   string(sortDir),
		Search:    q.Search,
	})
}

func (h *handler) handleRowLookup(w http.ResponseWriter, r *http.Request) {
	tableName := chi.URLParam(r, "tableName")
	if tableName == "" {
		writeError(w, http.StatusBadRequest, "tableName is required")
		return
	}

	field := r.URL.Query().Get("field")
	value := r.URL.Query().Get("value")

	if field == "" || value == "" {
		writeError(w, http.StatusBadRequest, "field and value are required")
		return
	}

	columns, rows, err := h.studio.LookupRows(r.Context(), tableName, field, value)
	if err != nil {
		writeServiceError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, lookupResponse{
		TableName: tableName,
		Field:     field,
		Value:     value,
		Columns:   columns,
		Rows:      rows,
	})
}

func (h *handler) handleUpdateRow(w http.ResponseWriter, r *http.Request) {
	tableName := chi.URLParam(r, "tableName")
	if tableName == "" {
		writeError(w, http.StatusBadRequest, "tableName is required")
		return
	}

	var req updateRowRequest
	if !decodeJSON(w, r, &req) {
		return
	}

	if req.PKField == "" || req.PKValue == "" || req.TargetField == "" {
		writeError(w, http.StatusBadRequest, "pkField, pkValue and targetField are required")
		return
	}

	err := h.studio.UpdateRow(r.Context(), studio.RowUpdate{
		Table:       tableName,
		PKField:     req.PKField,
		PKValue:     req.PKValue,
		TargetField: req.TargetField,
		NewValue:    req.NewValue,
	})
	if err != nil {
		writeServiceError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
