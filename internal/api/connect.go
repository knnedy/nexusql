package api

import (
	"errors"
	"net/http"

	"github.com/knnedy/nexusql/internal/db"
	"github.com/knnedy/nexusql/internal/studio"
)

type connectRequest struct {
	URI  string `json:"uri"`
	Name string `json:"name"`
}

type connectResponse struct {
	OK        bool            `json:"ok"`
	Provider  db.ProviderKind `json:"provider"`
	ProjectID string          `json:"projectId"`
}

func (h *handler) handleConnect(w http.ResponseWriter, r *http.Request) {
	var req connectRequest
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	res, err := h.studio.Connect(r.Context(), req.URI, req.Name)
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
