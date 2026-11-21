package config_test

import (
	"os"
	"path/filepath"
	"regexp"
	"testing"

	"github.com/knnedy/nexusql/internal/config"
	"github.com/knnedy/nexusql/internal/db"
)

func TestLoadBindsLoopbackByDefault(t *testing.T) {
	cfg, err := config.Load(config.Flags{})
	if err != nil {
		t.Fatal(err)
	}
	if cfg.Addr() != "127.0.0.1:7080" || cfg.Token != "" {
		t.Fatalf("got addr %q token %q, want 127.0.0.1:7080 and no token", cfg.Addr(), cfg.Token)
	}
}

func TestLoadAllowsLoopbackHostsWithoutExpose(t *testing.T) {
	for _, host := range []string{"127.0.0.1", "127.0.0.2", "localhost", "::1"} {
		if _, err := config.Load(config.Flags{Host: host}); err != nil {
			t.Errorf("host %q: %v", host, err)
		}
	}
}

func TestLoadRefusesNonLoopbackWithoutExpose(t *testing.T) {
	for _, host := range []string{"0.0.0.0", "192.168.1.10", "::", "example.com"} {
		if _, err := config.Load(config.Flags{Host: host}); err == nil {
			t.Errorf("host %q: want error without -expose", host)
		}
	}
}

func TestLoadWithExposeGeneratesToken(t *testing.T) {
	a, err := config.Load(config.Flags{Host: "0.0.0.0", Expose: true})
	if err != nil {
		t.Fatal(err)
	}
	b, _ := config.Load(config.Flags{Host: "0.0.0.0", Expose: true})
	if !regexp.MustCompile(`^[0-9a-f]{64}$`).MatchString(a.Token) {
		t.Fatalf("token %q, want 64 hex chars", a.Token)
	}
	if a.Token == b.Token {
		t.Fatal("two runs produced the same token")
	}
}

func TestSQLiteFiles(t *testing.T) {
	dir := t.TempDir()
	notDir := filepath.Join(dir, "file")
	if err := os.WriteFile(notDir, nil, 0o600); err != nil {
		t.Fatal(err)
	}
	cases := []struct {
		name    string
		f       config.Flags
		want    db.Options
		wantErr bool
	}{
		{"local, anywhere", config.Flags{}, db.Options{}, false},
		{"local, confined", config.Flags{SQLiteDir: dir}, db.Options{FileRoot: dir}, false},
		{"exposed without a directory", config.Flags{Host: "0.0.0.0", Expose: true}, db.Options{NoFiles: true}, false},
		{"exposed, confined", config.Flags{Host: "0.0.0.0", Expose: true, SQLiteDir: dir}, db.Options{FileRoot: dir}, false},
		{"missing directory", config.Flags{SQLiteDir: filepath.Join(dir, "nope")}, db.Options{}, true},
		{"not a directory", config.Flags{SQLiteDir: notDir}, db.Options{}, true},
	}
	for _, c := range cases {
		cfg, err := config.Load(c.f)
		if (err != nil) != c.wantErr || (err == nil && cfg.Files != c.want) {
			t.Errorf("%s: files %+v err %v, want %+v (error %v)", c.name, cfg.Files, err, c.want, c.wantErr)
		}
	}
}
