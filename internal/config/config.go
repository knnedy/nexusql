// Package config turns command-line flags and environment into runtime settings.
package config

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net"
	"os"
)

// Flags are the raw command-line values.
type Flags struct {
	Host   string
	Port   string
	Expose bool // explicit opt-in to bind a non-loopback interface
}

// Config is the validated runtime configuration.
type Config struct {
	Host   string
	Port   string
	IsDev  bool
	Expose bool
	Token  string // required on every request when Expose is set
}

// Load validates flags; binding beyond loopback requires Expose and yields a token.
func Load(f Flags) (Config, error) {
	cfg := Config{
		Host:   "127.0.0.1",
		Port:   "7080",
		IsDev:  os.Getenv("NEXUSQL_ENV") == "development",
		Expose: f.Expose,
	}
	if f.Host != "" {
		cfg.Host = f.Host
	}
	if f.Port != "" {
		cfg.Port = f.Port
	}

	if !IsLoopback(cfg.Host) && !f.Expose {
		return Config{}, fmt.Errorf(
			"refusing to bind %s: it is reachable from other machines and NexusQL has full database access; pass -expose to allow it (an access token will be required)",
			cfg.Host)
	}

	if f.Expose {
		buf := make([]byte, 32)
		if _, err := rand.Read(buf); err != nil {
			return Config{}, fmt.Errorf("generate access token: %w", err)
		}
		cfg.Token = hex.EncodeToString(buf)
	}
	return cfg, nil
}

// IsLoopback reports whether host only accepts connections from this machine.
func IsLoopback(host string) bool {
	if host == "localhost" {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

// Addr is the listen address.
func (c Config) Addr() string {
	return net.JoinHostPort(c.Host, c.Port)
}
