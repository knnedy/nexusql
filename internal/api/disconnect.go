package api

import (
	"net/http"

	"github.com/knnedy/nexusql/internal/session"
)

func (h *handler) handleDisconnect(w http.ResponseWriter, r *http.Request) {
	if !h.session.IsConnected() {
		writeError(w, http.StatusConflict, session.ErrNoActiveConnection.Error())
		return
	}

	h.session.Clear()

	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
