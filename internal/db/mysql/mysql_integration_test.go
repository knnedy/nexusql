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
		Export: dbtest.Export{
			Setup: []string{
				`CREATE TABLE users (id INT AUTO_INCREMENT PRIMARY KEY, email VARCHAR(255) NOT NULL UNIQUE, name TEXT,
					created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), joined TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
					active TINYINT(1) NOT NULL DEFAULT 1, settings JSON, uid VARCHAR(36) NOT NULL DEFAULT (uuid()),
					visits INT UNSIGNED NOT NULL DEFAULT 0)`,
				`CREATE TABLE posts (id BIGINT AUTO_INCREMENT PRIMARY KEY, author_id INT NOT NULL, editor_id INT,
					title VARCHAR(200) NOT NULL DEFAULT 'it''s "new"',
					status ENUM('todo', 'in progress', 'done') NOT NULL DEFAULT 'todo',
					body BLOB, score DECIMAL(10,2) DEFAULT 1.50, ratio FLOAT, published_on DATE,
					FOREIGN KEY (author_id) REFERENCES users (id), FOREIGN KEY (editor_id) REFERENCES users (id))`,
				`CREATE INDEX posts_title_idx ON posts (title)`,
				`CREATE INDEX by_author ON posts (author_id, published_on)`,
				`CREATE TABLE categories (id INT AUTO_INCREMENT PRIMARY KEY, parent_id INT, slug VARCHAR(40) NOT NULL,
					FOREIGN KEY (parent_id) REFERENCES categories (id), UNIQUE (parent_id, slug))`,
				`CREATE TABLE tags (code VARCHAR(20) PRIMARY KEY, label TEXT)`,
				`CREATE TABLE post_tags (post_id BIGINT NOT NULL, tag_code VARCHAR(20) NOT NULL, PRIMARY KEY (post_id, tag_code),
					FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE, FOREIGN KEY (tag_code) REFERENCES tags (code))`,
				`CREATE TABLE regions (country CHAR(2), code VARCHAR(10), PRIMARY KEY (country, code))`,
				`CREATE TABLE offices (id INT PRIMARY KEY, country CHAR(2) NOT NULL, code VARCHAR(10) NOT NULL,
					FOREIGN KEY (country, code) REFERENCES regions (country, code) ON DELETE CASCADE ON UPDATE CASCADE)`,
				`CREATE TABLE invites (id INT AUTO_INCREMENT PRIMARY KEY, email VARCHAR(255),
					FOREIGN KEY (email) REFERENCES users (email) ON DELETE SET NULL)`,
				"CREATE TABLE `order items` (id INT AUTO_INCREMENT PRIMARY KEY, `unit price` FLOAT, qty INT NOT NULL CHECK (qty > 0), note VARCHAR(20), CONSTRAINT note_set CHECK (note <> 'it''s'))",
				`CREATE TABLE audit_log (at DATETIME, msg TEXT)`,
			},
		},
		Columns: dbtest.Columns{
			Setup: []string{`CREATE TABLE d (id INT AUTO_INCREMENT PRIMARY KEY, title VARCHAR(20) DEFAULT 'it''s',
				n INT DEFAULT 5, at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, price DECIMAL(10,2) DEFAULT 1.50,
				u VARCHAR(36) DEFAULT (uuid()))`},
			Want: map[string][2]string{
				"id": {"int", "<none>"}, "title": {"varchar(20)", "'it''s'"}, "n": {"int", "5"},
				"at": {"timestamp", "CURRENT_TIMESTAMP"}, "price": {"decimal(10,2)", "1.50"}, "u": {"varchar(36)", "(uuid())"},
			},
		},
		Seed: dbtest.Seed{
			Setup: []string{
				`CREATE TABLE files (id INT AUTO_INCREMENT PRIMARY KEY, data VARBINARY(64) NOT NULL)`,
				`CREATE TABLE flags (id INT AUTO_INCREMENT PRIMARY KEY, on_off BOOLEAN NOT NULL UNIQUE)`,
				`CREATE TABLE scores (id INT AUTO_INCREMENT PRIMARY KEY, n INT NOT NULL CHECK (n BETWEEN 1 AND 50))`,
				`CREATE TABLE tasks (id INT AUTO_INCREMENT PRIMARY KEY, status ENUM('todo', 'doing', 'done') NOT NULL)`,
				`CREATE TABLE categories (id INT AUTO_INCREMENT PRIMARY KEY, parent_id INT,
					FOREIGN KEY (parent_id) REFERENCES categories (id))`,
				`CREATE TABLE teams (id INT AUTO_INCREMENT PRIMARY KEY, captain_id INT)`,
				`CREATE TABLE players (id INT AUTO_INCREMENT PRIMARY KEY, team_id INT NOT NULL,
					FOREIGN KEY (team_id) REFERENCES teams (id))`,
				`ALTER TABLE teams ADD FOREIGN KEY (captain_id) REFERENCES players (id)`,
				`CREATE TABLE memberships (player_id INT NOT NULL, team_id INT NOT NULL, PRIMARY KEY (player_id, team_id),
					FOREIGN KEY (player_id) REFERENCES players (id), FOREIGN KEY (team_id) REFERENCES teams (id))`,
				`CREATE TABLE regions (country VARCHAR(40), code VARCHAR(40), PRIMARY KEY (country, code))`,
				`CREATE TABLE offices (id INT AUTO_INCREMENT PRIMARY KEY, country VARCHAR(40) NOT NULL, code VARCHAR(40) NOT NULL,
					FOREIGN KEY (country, code) REFERENCES regions (country, code))`,
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
