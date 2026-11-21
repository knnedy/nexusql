package mysql

import (
	"fmt"
	"net/url"
	"slices"
	"strings"

	"github.com/go-sql-driver/mysql"
	"github.com/knnedy/nexusql/internal/db"
)

// options are the URI query options passed to the driver. Others are refused:
// unknown ones become session variables, and some (allowAllFiles) let a
// server read local files.
var options = []string{"tls", "charset", "collation", "timeout", "readTimeout", "writeTimeout"}

// config turns a "mysql://user:pass@host:port/dbname?tls=true" URI into a
// driver config. Credentials are set on it directly, never formatted into a DSN.
func config(uri string) (*mysql.Config, error) {
	if !strings.HasPrefix(uri, "mysql://") {
		return nil, fmt.Errorf("expected mysql:// URI, got: %s", db.RedactURI(uri))
	}
	parsed, err := url.Parse(uri)
	if err != nil {
		return nil, fmt.Errorf("failed to parse URI: %s", db.RedactURI(uri))
	}
	if parsed.Host == "" {
		return nil, fmt.Errorf("mysql URI missing host")
	}
	dbName := strings.TrimPrefix(parsed.Path, "/")
	if dbName == "" {
		return nil, fmt.Errorf("mysql URI missing database name")
	}

	query := parsed.Query()
	for name := range query {
		if !slices.Contains(options, name) {
			return nil, fmt.Errorf("mysql URI option %q is not supported (supported: %s)", name, strings.Join(options, ", "))
		}
	}
	cfg, err := mysql.ParseDSN("/?" + query.Encode()) // the driver validates the option values
	if err != nil {
		return nil, fmt.Errorf("mysql URI options: %w", err)
	}
	cfg.Net, cfg.Addr, cfg.DBName = "tcp", parsed.Host, dbName
	if parsed.User != nil {
		cfg.User = parsed.User.Username()
		cfg.Passwd, _ = parsed.User.Password()
	}
	// parseTime: dates scan as time.Time. clientFoundRows: affected counts match
	// Postgres and SQLite. time_zone UTC: TIMESTAMP values arrive as UTC instants.
	cfg.ParseTime, cfg.ClientFoundRows = true, true
	cfg.Params = map[string]string{"time_zone": "'+00:00'"}
	return cfg, nil
}
