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

	sortCol := ""
	sortDir := db.SortAsc

	if sc := r.URL.Query().Get("sort"); sc != "" {
		schema, schemaErr := conn.Impl.IntrospectSchema(r.Context(), "public")
		if schemaErr != nil {
			writeError(w, http.StatusInternalServerError, schemaErr.Error())
			return
		}

		var table *db.Table
		for i := range schema.Tables {
			if schema.Tables[i].Name == tableName {
				table = &schema.Tables[i]
				break
			}
		}
		if table == nil {
			writeError(w, http.StatusBadRequest, "unknown table")
			return
		}

		for _, f := range table.Fields {
			if f.Name == sc {
				sortCol = sc
				break
			}
		}
		if sortCol == "" {
			writeError(w, http.StatusBadRequest, "invalid sort column")
			return
		}
	}

	if sd := r.URL.Query().Get("dir"); sd == "desc" {
		sortDir = db.SortDesc
	}

	search := r.URL.Query().Get("search")

	offset := (page - 1) * pageSize

	columns, rows, total, err := conn.Impl.FetchRows(r.Context(), tableName, pageSize, offset, sortCol, sortDir, search)
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
		SortCol:   sortCol,
		SortDir:   string(sortDir),
		Search:    search,
	})
}

func (h *handler) handleRowLookup(w http.ResponseWriter, r *http.Request) {
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

	field := r.URL.Query().Get("field")
	value := r.URL.Query().Get("value")

	if field == "" || value == "" {
		writeError(w, http.StatusBadRequest, "field and value are required")
		return
	}

	columns, rows, err := conn.Impl.FetchRowWhere(r.Context(), tableName, field, value)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
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

	var req updateRowRequest
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.PKField == "" || req.PKValue == "" || req.TargetField == "" {
		writeError(w, http.StatusBadRequest, "pkField, pkValue and targetField are required")
		return
	}

	if err := conn.Impl.UpdateRow(r.Context(), tableName, req.PKField, req.PKValue, req.TargetField, req.NewValue); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
