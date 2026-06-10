package config

type Config struct {
	Port string
	Host string
}

func Load() Config {
	return Config{
		Port: "7080",
		Host: "127.0.0.1",
	}
}

func (c Config) Addr() string {
	return c.Host + ":" + c.Port
}
