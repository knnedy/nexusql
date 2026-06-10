package api

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/knnedy/nexusql/internal/db"
	"github.com/knnedy/nexusql/internal/session"
)

type connectRequest struct {
	URI  string `json:"uri"`
	Name string `json:"name"`
}

type connectResponse struct {
	OK       bool        `json:"ok"`
	Provider db.Provider `json:"provider"`
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

	if h.session.IsConnected() {
		writeError(w, http.StatusConflict, session.ErrAlreadyConnected.Error())
		return
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

	// persist project if a name was provided
	if req.Name != "" {
		_, err := h.projects.Create(req.Name, req.URI, conn.Provider)
		if err != nil {
			// non-fatal, connection is live, project save failed
		}
	}

	writeJSON(w, http.StatusOK, connectResponse{
		OK:       true,
		Provider: conn.Provider,
	})
}
