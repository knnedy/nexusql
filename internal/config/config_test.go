package config_test

import (
	"regexp"
	"testing"

	"github.com/knnedy/nexusql/internal/config"
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
