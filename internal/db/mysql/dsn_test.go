package mysql

import (
	"strings"
	"testing"
	"time"
)

func TestConfigKeepsCredentialsExact(t *testing.T) {
	cfg, err := config("mysql://us%40er:p%40ss%3Aw%2Frd%3F%23%25@db.example.com:3307/app")
	if err != nil {
		t.Fatal(err)
	}
	if cfg.User != "us@er" || cfg.Passwd != "p@ss:w/rd?#%" || cfg.Addr != "db.example.com:3307" || cfg.DBName != "app" {
		t.Fatalf("user %q pass %q addr %q db %q", cfg.User, cfg.Passwd, cfg.Addr, cfg.DBName)
	}
}

func TestConfigPassesSupportedOptions(t *testing.T) {
	cfg, err := config("mysql://u:p@h:3306/app?tls=skip-verify&timeout=5s&charset=utf8mb4")
	if err != nil {
		t.Fatal(err)
	}
	if cfg.TLSConfig != "skip-verify" || cfg.Timeout != 5*time.Second || !strings.Contains(cfg.FormatDSN(), "charset=utf8mb4") {
		t.Fatalf("tls %q timeout %v dsn %s", cfg.TLSConfig, cfg.Timeout, cfg.FormatDSN())
	}
	if !cfg.ParseTime || !cfg.ClientFoundRows || cfg.Params["time_zone"] != "'+00:00'" {
		t.Fatalf("settings the provider relies on were lost: %+v", cfg)
	}
}

func TestConfigRefusesOtherOptions(t *testing.T) {
	for _, opt := range []string{"allowAllFiles=true", "parseTime=false", "sql_mode=''"} {
		_, err := config("mysql://u:p@h/app?" + opt)
		if err == nil || !strings.Contains(err.Error(), "not supported") {
			t.Errorf("%s: err = %v, want it refused", opt, err)
		}
	}
}
