// Package gormcheck runs GORM's AutoMigrate for exported models. The export
// test writes out/<dialect>/main.go, run as: go run ./out/<dialect> <dialect> <uri>.
package gormcheck

import (
	"fmt"
	"net/url"
	"os"
	"strings"

	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// Main migrates models into the database named by os.Args[1:] and exits non-zero on failure.
func Main(models ...any) {
	if err := run(os.Args[1], os.Args[2], models); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run(dialect, uri string, models []any) error {
	var d gorm.Dialector
	switch dialect {
	case "postgres":
		d = postgres.Open(uri)
	case "mysql":
		u, err := url.Parse(uri)
		if err != nil {
			return err
		}
		pw, _ := u.User.Password()
		d = mysql.Open(fmt.Sprintf("%s:%s@tcp(%s)%s?parseTime=true", u.User.Username(), pw, u.Host, u.Path))
	case "sqlite":
		d = sqlite.Open(strings.TrimPrefix(uri, "sqlite://"))
	default:
		return fmt.Errorf("unknown dialect %q", dialect)
	}
	db, err := gorm.Open(d, &gorm.Config{Logger: logger.Default.LogMode(logger.Error)})
	if err != nil {
		return err
	}
	return db.AutoMigrate(models...)
}
