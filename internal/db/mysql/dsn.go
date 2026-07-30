package mysql

import (
	"fmt"
	"net/url"
	"strings"
)

// toDSN converts a "mysql://user:pass@host:port/dbname" URI into the DSN
// format github.com/go-sql-driver/mysql expects: "user:pass@tcp(host:port)/dbname".
func toDSN(uri string) (string, error) {
	if !strings.HasPrefix(uri, "mysql://") {
		return "", fmt.Errorf("expected mysql:// URI, got: %s", uri)
	}

	parsed, err := url.Parse(uri)
	if err != nil {
		return "", fmt.Errorf("failed to parse URI: %w", err)
	}

	if parsed.Host == "" {
		return "", fmt.Errorf("mysql URI missing host")
	}

	dbName := strings.TrimPrefix(parsed.Path, "/")
	if dbName == "" {
		return "", fmt.Errorf("mysql URI missing database name")
	}

	var userInfo string
	if parsed.User != nil {
		user := parsed.User.Username()
		if pass, ok := parsed.User.Password(); ok {
			userInfo = fmt.Sprintf("%s:%s@", user, pass)
		} else {
			userInfo = fmt.Sprintf("%s@", user)
		}
	}

	// parseTime=true so DATE/DATETIME/TIMESTAMP columns scan into
	// time.Time rather than []byte — matters for rows.go/schema.go
	// value normalization, same reasoning as the type-affinity work
	// done for the SQLite provider.
	return fmt.Sprintf("%stcp(%s)/%s?parseTime=true", userInfo, parsed.Host, dbName), nil
}
