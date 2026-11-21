package api

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/knnedy/nexusql/internal/db"
	"github.com/knnedy/nexusql/internal/session"
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

// activeConn returns the session's connection, or writes the error and reports false.
func (h *handler) activeConn(w http.ResponseWriter) (*db.Connection, bool) {
	conn, err := h.session.Get()
	if errors.Is(err, session.ErrNoActiveConnection) {
		writeError(w, http.StatusUnauthorized, err.Error())
		return nil, false
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return nil, false
	}
	return conn, true
}
