package api

import "net/http"

type healthResponse struct {
	Status  string `json:"status"`
	Version string `json:"version"`
}

func (h *handler) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, healthResponse{
		Status:  "ok",
		Version: h.version,
	})
}
