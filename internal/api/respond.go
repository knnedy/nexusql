package api

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/knnedy/nexusql/internal/studio"
)

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func readJSON(r *http.Request, v any) error {
	defer r.Body.Close()
	return json.NewDecoder(r.Body).Decode(v)
}

// writeServiceError maps studio error classes to HTTP status codes.
func writeServiceError(w http.ResponseWriter, err error) {
	status := http.StatusInternalServerError
	switch {
	case errors.Is(err, studio.ErrNoConnection):
		status = http.StatusUnauthorized
	case errors.Is(err, studio.ErrInvalid):
		status = http.StatusBadRequest
	case errors.Is(err, studio.ErrNotFound):
		status = http.StatusNotFound
	case errors.Is(err, studio.ErrConflict):
		status = http.StatusConflict
	}
	writeError(w, status, err.Error())
}
