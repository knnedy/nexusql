package api

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/knnedy/nexusql/internal/projects"
)

func (h *handler) handleTouchProject(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "id is required")
		return
	}

	if err := h.projects.Touch(id); err == projects.ErrProjectNotFound {
		writeError(w, http.StatusNotFound, err.Error())
		return
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
