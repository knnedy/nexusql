package dbtest

// Fixture tables every Harness.Schema must create, in dialect DDL:
//
//	users(id auto-increment PK, email text NOT NULL, name text NULL)
//	posts(id auto-increment PK, user_id int NOT NULL FK -> users.id, title text NOT NULL)
//
// Rows are inserted without ids so every dialect assigns 1..n in order.
var fixtureRows = []string{
	`INSERT INTO users (email, name) VALUES ('ada@example.com', 'Ada')`,
	`INSERT INTO users (email, name) VALUES ('bob@example.com', NULL)`,
	`INSERT INTO users (email, name) VALUES ('cy@example.com', 'Cy')`,
	`INSERT INTO posts (user_id, title) VALUES (1, 'Hello')`,
	`INSERT INTO posts (user_id, title) VALUES (1, 'Second')`,
	`INSERT INTO posts (user_id, title) VALUES (3, 'Third')`,
}
