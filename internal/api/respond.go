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

// maxBody caps JSON request bodies; the largest legitimate one is console SQL.
const maxBody = 1 << 20

// decodeJSON reads a capped JSON body into v, writing 413 or 400 on failure.
func decodeJSON(w http.ResponseWriter, r *http.Request, v any) bool {
	defer r.Body.Close()
	err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBody)).Decode(v)
	if err == nil {
		return true
	}
	if _, tooBig := errors.AsType[*http.MaxBytesError](err); tooBig {
		writeError(w, http.StatusRequestEntityTooLarge, "request body exceeds 1 MiB")
	} else {
		writeError(w, http.StatusBadRequest, "invalid request body")
	}
	return false
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
	case errors.Is(err, studio.ErrTimeout):
		status = http.StatusGatewayTimeout
	}
	writeError(w, status, err.Error())
}
