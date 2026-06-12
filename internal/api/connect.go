package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/knnedy/nexusql/internal/db"
)

type connectRequest struct {
	URI  string `json:"uri"`
	Name string `json:"name"`
}

type connectResponse struct {
	OK        bool        `json:"ok"`
	Provider  db.Provider `json:"provider"`
	ProjectID string      `json:"projectId"`
}

func (h *handler) handleConnect(w http.ResponseWriter, r *http.Request) {
	var req connectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.URI == "" {
		writeError(w, http.StatusBadRequest, "uri is required")
		return
	}

	// auto-disconnect any existing connection before reconnecting
	if h.session.IsConnected() {
		h.session.Clear()
	}

	conn, err := db.Connect(context.Background(), req.URI)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	if err := h.session.Set(conn); err != nil {
		conn.Close()
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	name := req.Name
	if name == "" {
		name = fmt.Sprintf("Project %s", conn.Provider)
	}

	p, err := h.projects.Create(name, req.URI, conn.Provider)
	if err != nil {
		// project with same name exists — find by URI and return it
		for _, existing := range h.projects.List() {
			if existing.URI == req.URI {
				writeJSON(w, http.StatusOK, connectResponse{
					OK:        true,
					Provider:  conn.Provider,
					ProjectID: existing.ID,
				})
				return
			}
		}
		writeJSON(w, http.StatusOK, connectResponse{
			OK:       true,
			Provider: conn.Provider,
		})
		return
	}

	writeJSON(w, http.StatusOK, connectResponse{
		OK:        true,
		Provider:  conn.Provider,
		ProjectID: p.ID,
	})
}
