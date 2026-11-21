//go:build integration

package mysql_test

import (
	"context"
	"testing"

	"github.com/knnedy/nexusql/internal/db"
	"github.com/knnedy/nexusql/internal/db/dbtest"
	"github.com/knnedy/nexusql/internal/db/mysql"
)

func TestConformance(t *testing.T) {
	dbtest.Run(t, dbtest.Harness{
		Open: func(t *testing.T) db.Provider {
			p, err := mysql.Connect(context.Background(), dbtest.MySQLDB(t))
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
