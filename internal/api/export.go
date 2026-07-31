package api

import (
	"fmt"
	"net/http"

	"github.com/knnedy/nexusql/internal/db"
	"github.com/knnedy/nexusql/internal/db/mysql"
	"github.com/knnedy/nexusql/internal/db/postgres"
	"github.com/knnedy/nexusql/internal/db/sqlite"
	"github.com/knnedy/nexusql/internal/session"
)

type exportResponse struct {
	Target string `json:"target"`
	Schema string `json:"schema"`
}

func generatePrisma(kind db.ProviderKind, schema *db.Schema) (string, error) {
	switch kind {
	case db.ProviderKindPostgres:
		return postgres.GeneratePrisma(schema), nil
	case db.ProviderKindSQLite:
		return sqlite.GeneratePrisma(schema), nil
	case db.ProviderKindMySQL:
		return mysql.GeneratePrisma(schema), nil
	default:
		return "", fmt.Errorf("prisma export not supported for provider: %s", kind)
	}
}

func generateDrizzle(kind db.ProviderKind, schema *db.Schema) (string, error) {
	switch kind {
	case db.ProviderKindPostgres:
		return postgres.GenerateDrizzle(schema), nil
	case db.ProviderKindSQLite:
		return sqlite.GenerateDrizzle(schema), nil
	case db.ProviderKindMySQL:
		return mysql.GenerateDrizzle(schema), nil
	default:
		return "", fmt.Errorf("drizzle export not supported for provider: %s", kind)
	}
}

func (h *handler) handleExportPrisma(w http.ResponseWriter, r *http.Request) {
	conn, err := h.session.Get()
	if err == session.ErrNoActiveConnection {
		writeError(w, http.StatusUnauthorized, err.Error())
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	schema, err := conn.Impl.IntrospectSchema(r.Context(), conn.Impl.DefaultSchema())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	out, err := generatePrisma(conn.Kind, schema)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, exportResponse{
		Target: "prisma",
		Schema: out,
	})
}

func (h *handler) handleExportDrizzle(w http.ResponseWriter, r *http.Request) {
	conn, err := h.session.Get()
	if err == session.ErrNoActiveConnection {
		writeError(w, http.StatusUnauthorized, err.Error())
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	schema, err := conn.Impl.IntrospectSchema(r.Context(), conn.Impl.DefaultSchema())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	out, err := generateDrizzle(conn.Kind, schema)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, exportResponse{
		Target: "drizzle",
		Schema: out,
	})
}
