//go:build integration

package studio_test

import (
	"testing"

	"github.com/knnedy/nexusql/internal/db/dbtest"
	_ "github.com/knnedy/nexusql/internal/db/mysql"
	_ "github.com/knnedy/nexusql/internal/db/postgres"
)

func TestPostgres(t *testing.T) { testDialect(t, dbtest.PostgresDB(t)) }
func TestMySQL(t *testing.T)    { testDialect(t, dbtest.MySQLDB(t)) }
