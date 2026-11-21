//go:build integration

package dbtest

import (
	"context"
	"database/sql"
	"fmt"
	"sync"
	"sync/atomic"
	"testing"

	_ "github.com/go-sql-driver/mysql"
	"github.com/jackc/pgx/v5"
	tcmysql "github.com/testcontainers/testcontainers-go/modules/mysql"
	tcpostgres "github.com/testcontainers/testcontainers-go/modules/postgres"
)

// One container per dialect per test binary, started on first use; the
// testcontainers reaper removes them when the binary exits.
type server struct {
	once  sync.Once
	err   error
	host  string // host:port
	admin string // admin connection string
}

var (
	pg, my server
	dbSeq  atomic.Int64
)

// PostgresDB creates an empty Postgres database and returns its URI; it is dropped on cleanup.
func PostgresDB(t *testing.T) string {
	t.Helper()
	ctx := context.Background()
	pg.once.Do(func() {
		ctr, err := tcpostgres.Run(ctx, "postgres:17-alpine",
			tcpostgres.WithUsername("nexusql"), tcpostgres.WithPassword("nexusql"),
			tcpostgres.BasicWaitStrategies())
		if err != nil {
			pg.err = err
			return
		}
		if pg.admin, pg.err = ctr.ConnectionString(ctx, "sslmode=disable"); pg.err != nil {
			return
		}
		pg.host, pg.err = ctr.PortEndpoint(ctx, "5432/tcp", "")
	})
	if pg.err != nil {
		t.Fatalf("start postgres: %v", pg.err)
	}

	name := fmt.Sprintf("t%d", dbSeq.Add(1))
	pgAdmin(t, "CREATE DATABASE "+name)
	t.Cleanup(func() { pgAdmin(t, "DROP DATABASE IF EXISTS "+name+" WITH (FORCE)") })
	return fmt.Sprintf("postgres://nexusql:nexusql@%s/%s?sslmode=disable", pg.host, name)
}

func pgAdmin(t *testing.T, stmt string) {
	ctx := context.Background()
	conn, err := pgx.Connect(ctx, pg.admin)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close(ctx)
	if _, err := conn.Exec(ctx, stmt); err != nil {
		t.Fatal(err)
	}
}

// MySQLDB creates an empty MySQL database and returns its URI; it is dropped on cleanup.
func MySQLDB(t *testing.T) string {
	t.Helper()
	ctx := context.Background()
	my.once.Do(func() {
		ctr, err := tcmysql.Run(ctx, "mysql:8.4",
			tcmysql.WithUsername("root"), tcmysql.WithPassword("nexusql"),
			tcmysql.WithDatabase("nexusql"))
		if err != nil {
			my.err = err
			return
		}
		if my.admin, my.err = ctr.ConnectionString(ctx); my.err != nil {
			return
		}
		my.host, my.err = ctr.PortEndpoint(ctx, "3306/tcp", "")
	})
	if my.err != nil {
		t.Fatalf("start mysql: %v", my.err)
	}

	name := fmt.Sprintf("t%d", dbSeq.Add(1))
	myAdmin(t, "CREATE DATABASE "+name)
	t.Cleanup(func() { myAdmin(t, "DROP DATABASE IF EXISTS "+name) })
	return fmt.Sprintf("mysql://root:nexusql@%s/%s", my.host, name)
}

func myAdmin(t *testing.T, stmt string) {
	conn, err := sql.Open("mysql", my.admin)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()
	if _, err := conn.Exec(stmt); err != nil {
		t.Fatal(err)
	}
}
