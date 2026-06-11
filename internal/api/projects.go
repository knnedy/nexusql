package api

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/knnedy/nexusql/internal/db"
	"github.com/knnedy/nexusql/internal/projects"
)

func (h *handler) handleListProjects(w http.ResponseWriter, r *http.Request) {
	list := h.projects.List()
	writeJSON(w, http.StatusOK, map[string]any{"projects": list})
}

func (h *handler) handleCreateProject(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name string `json:"name"`
		URI  string `json:"uri"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}

	if req.URI == "" {
		writeError(w, http.StatusBadRequest, "uri is required")
		return
	}

	provider, err := db.DetectProvider(req.URI)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	p, err := h.projects.Create(req.Name, req.URI, provider)
	if err == projects.ErrProjectExists {
		writeError(w, http.StatusConflict, err.Error())
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{"project": p})
}

func (h *handler) handleRenameProject(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "id is required")
		return
	}

	var req struct {
		Name string `json:"name"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}

	if err := h.projects.Rename(id, req.Name); err == projects.ErrProjectNotFound {
		writeError(w, http.StatusNotFound, err.Error())
		return
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}

func (h *handler) handleDeleteProject(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "id is required")
		return
	}

	if err := h.projects.Delete(id); err == projects.ErrProjectNotFound {
		writeError(w, http.StatusNotFound, err.Error())
		return
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
