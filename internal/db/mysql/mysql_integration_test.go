//go:build integration

package mysql_test

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"sync/atomic"
	"testing"

	_ "github.com/go-sql-driver/mysql"
	"github.com/knnedy/nexusql/internal/db"
	"github.com/knnedy/nexusql/internal/db/dbtest"
	"github.com/knnedy/nexusql/internal/db/mysql"
	tcmysql "github.com/testcontainers/testcontainers-go/modules/mysql"
)

var (
	admin    *sql.DB // root connection used to create per-test databases
	baseHost string  // host:port of the container
	dbSeq    atomic.Int64
)

func TestMain(m *testing.M) {
	ctx := context.Background()
	ctr, err := tcmysql.Run(ctx, "mysql:8.4",
		tcmysql.WithUsername("root"), tcmysql.WithPassword("nexusql"),
		tcmysql.WithDatabase("nexusql"))
	if err != nil {
		log.Fatalf("start mysql: %v", err)
	}
	dsn, err := ctr.ConnectionString(ctx)
	if err != nil {
		log.Fatal(err)
	}
	if admin, err = sql.Open("mysql", dsn); err != nil {
		log.Fatal(err)
	}
	if baseHost, err = ctr.PortEndpoint(ctx, "3306/tcp", ""); err != nil {
		log.Fatal(err)
	}
	code := m.Run()
	admin.Close()
	_ = ctr.Terminate(ctx)
	os.Exit(code)
}

// freshDB creates an empty database and returns its URI; it is dropped on cleanup.
func freshDB(t *testing.T) string {
	t.Helper()
	name := fmt.Sprintf("t%d", dbSeq.Add(1))
	if _, err := admin.Exec("CREATE DATABASE " + name); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = admin.Exec("DROP DATABASE IF EXISTS " + name) })
	return fmt.Sprintf("mysql://root:nexusql@%s/%s", baseHost, name)
}

func TestConformance(t *testing.T) {
	dbtest.Run(t, dbtest.Harness{
		Open: func(t *testing.T) db.Provider {
			p, err := mysql.Connect(context.Background(), freshDB(t))
			if err != nil {
				t.Fatalf("connect: %v", err)
			}
			t.Cleanup(p.Close)
			return p
		},
		Schema: []string{
			`CREATE TABLE users (
				id INT AUTO_INCREMENT PRIMARY KEY,
				email VARCHAR(255) NOT NULL,
				name VARCHAR(255) NULL
			)`,
			`CREATE TABLE posts (
				id INT AUTO_INCREMENT PRIMARY KEY,
				user_id INT NOT NULL,
				title VARCHAR(255) NOT NULL,
				FOREIGN KEY (user_id) REFERENCES users(id)
			)`,
		},
	})
}
