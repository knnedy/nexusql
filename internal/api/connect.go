package api

import (
	"errors"
	"net/http"

	"github.com/knnedy/nexusql/internal/db"
	"github.com/knnedy/nexusql/internal/studio"
)

// connectRequest names a saved project, or a new URI to connect to and save.
type connectRequest struct {
	ProjectID string `json:"projectId"`
	URI       string `json:"uri"`
	Name      string `json:"name"`
	// Create makes a new, empty database file (SQLite); otherwise it must exist.
	Create bool `json:"create"`
}

type connectResponse struct {
	OK        bool            `json:"ok"`
	Provider  db.ProviderKind `json:"provider"`
	ProjectID string          `json:"projectId"`
}

func (h *handler) handleConnect(w http.ResponseWriter, r *http.Request) {
	var req connectRequest
	if !decodeJSON(w, r, &req) {
		return
	}

	var res studio.ConnectResult
	var err error
	switch {
	case req.ProjectID != "":
		res, err = h.studio.OpenProject(r.Context(), req.ProjectID)
	case req.Create:
		res, err = h.studio.ConnectNew(r.Context(), req.URI, req.Name)
	default:
		res, err = h.studio.Connect(r.Context(), req.URI, req.Name)
	}
	if err != nil {
		writeServiceError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, connectResponse{
		OK:        true,
		Provider:  res.Provider,
		ProjectID: res.ProjectID,
	})
}

func (h *handler) handleDisconnect(w http.ResponseWriter, r *http.Request) {
	if err := h.studio.Disconnect(); errors.Is(err, studio.ErrNoConnection) {
		writeError(w, http.StatusConflict, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
