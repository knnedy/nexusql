//go:build integration

package studio_test

import (
	"testing"

	"github.com/knnedy/nexusql/internal/db/dbtest"
	_ "github.com/knnedy/nexusql/internal/db/mysql"
)

func TestPostgres(t *testing.T) { testDialect(t, dbtest.PostgresDB(t), `SELECT pg_sleep(30)`) }
func TestMySQL(t *testing.T)    { testDialect(t, dbtest.MySQLDB(t), `SELECT SLEEP(30)`) }
