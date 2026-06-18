package config

import "os"

type Config struct {
	Port  string
	Host  string
	IsDev bool
}

func Load() Config {
	return Config{
		Port:  "7080",
		Host:  "127.0.0.1",
		IsDev: os.Getenv("NEXUSQL_ENV") == "development",
	}
}

func (c Config) Addr() string {
	return c.Host + ":" + c.Port
}
