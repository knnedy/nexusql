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
		Values: dbtest.Values{
			Setup: []string{
				`CREATE TABLE vals (id INT PRIMARY KEY, big BIGINT, small INT, amount DECIMAL(30,6),
					fl DOUBLE, ts DATETIME(1), tstz TIMESTAMP, d DATE, js JSON, bin VARBINARY(8),
					flag BOOLEAN, blank TEXT)`,
				`INSERT INTO vals VALUES (1, 9007199254740993, 42, 12345678901234567.123456, 1.5,
					'2026-01-02 03:04:05.5', '2026-01-02 00:04:05', '2026-01-02', '{"a": 1}',
					x'DEADBEEF', true, NULL)`,
			},
			// BOOLEAN is TINYINT(1): the driver reports TINYINT, so it stays 0/1.
			Want: map[string]string{
				"big": `"9007199254740993"`, "small": `42`, "amount": `"12345678901234567.123456"`,
				"fl": `1.5`, "ts": `"2026-01-02T03:04:05.5"`, "tstz": `"2026-01-02T00:04:05Z"`,
				"d": `"2026-01-02"`, "js": `{"a":1}`, "bin": `"\\xdeadbeef"`, "flag": `1`,
				"blank": `null`,
			},
		},
		Seed: dbtest.Seed{
			Setup: []string{
				`CREATE TABLE files (id INT AUTO_INCREMENT PRIMARY KEY, data VARBINARY(64) NOT NULL)`,
				`CREATE TABLE flags (id INT AUTO_INCREMENT PRIMARY KEY, on_off BOOLEAN NOT NULL UNIQUE)`,
				`CREATE TABLE scores (id INT AUTO_INCREMENT PRIMARY KEY, n INT NOT NULL CHECK (n BETWEEN 1 AND 50))`,
			},
		},
		Keys: dbtest.Keys{
			Setup: []string{
				`CREATE TABLE parent (a INTEGER, b INTEGER, PRIMARY KEY (a, b))`,
				`CREATE TABLE child (id INTEGER PRIMARY KEY, pa INTEGER, pb INTEGER,
					FOREIGN KEY (pa, pb) REFERENCES parent (a, b))`,
				`CREATE TABLE auto_key (id INT AUTO_INCREMENT PRIMARY KEY, v TEXT)`,
			},
			Auto: map[string]bool{"auto_key.id": true, "child.id": false, "parent.a": false},
		},
	})
}
