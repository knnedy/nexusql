package config

import (
	"os"
	"strconv"
)

type Config struct {
	Port string
	Host string
}

func Load() Config {
	port := os.Getenv("NEXUSQL_PORT")
	if port == "" {
		port = "7080"
	}

	host := os.Getenv("NEXUSQL_HOST")
	if host == "" {
		host = "127.0.0.1"
	}

	// validate port is a number
	if _, err := strconv.Atoi(port); err != nil {
		port = "7080"
	}

	return Config{
		Port: port,
		Host: host,
	}
}

func (c Config) Addr() string {
	return c.Host + ":" + c.Port
}
