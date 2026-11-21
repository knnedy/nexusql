package api

import "net/http"

type readOnlyBody struct {
	ReadOnly *bool `json:"readOnly"`
}

func (h *handler) handleGetReadOnly(w http.ResponseWriter, r *http.Request) {
	on, err := h.studio.ReadOnly()
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"readOnly": on})
}

func (h *handler) handleSetReadOnly(w http.ResponseWriter, r *http.Request) {
	var body readOnlyBody
	if !decodeJSON(w, r, &body) {
		return
	}
	if body.ReadOnly == nil {
		writeError(w, http.StatusBadRequest, "readOnly is required")
		return
	}
	if err := h.studio.SetReadOnly(*body.ReadOnly); err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"readOnly": *body.ReadOnly})
}
