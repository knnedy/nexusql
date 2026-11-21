package db_test

import (
	"testing"

	"github.com/knnedy/nexusql/internal/db"
)

func TestRedactURI(t *testing.T) {
	for in, want := range map[string]string{
		"postgres://app:s3cret@db.local:5432/shop?sslmode=disable": "postgres://app:****@db.local:5432/shop?sslmode=disable",
		"mysql://root:p%40ss@127.0.0.1:3306/app":                   "mysql://root:****@127.0.0.1:3306/app",
		"postgres://app@db.local/shop":                             "postgres://app@db.local/shop",
		"sqlite:///home/me/data.db":                                "sqlite:///home/me/data.db",
		"postgres://app:pw@db.local/shop?password=other":           "postgres://app:****@db.local/shop?password=****",
		"host=db user=app password=s3cret dbname=shop":             "[unrecognised connection string]",
		"postgres://app:s3cret@[bad":                               "postgres://[unparseable]",
		"app:s3cret@host://x":                                      "[unrecognised connection string]",
	} {
		if got := db.RedactURI(in); got != want {
			t.Errorf("RedactURI(%q)\n got  %q\n want %q", in, got, want)
		}
	}
}
