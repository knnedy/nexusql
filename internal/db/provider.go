package db

import (
	"fmt"
	"strings"
)

type Provider string

const (
	ProviderPostgres Provider = "postgres"
)

func DetectProvider(uri string) (Provider, error) {
	switch {
	case strings.HasPrefix(uri, "postgres://"), strings.HasPrefix(uri, "postgresql://"):
		return ProviderPostgres, nil
	default:
		return "", fmt.Errorf("unsupported or unrecognised URI scheme: %s", uri)
	}
}

func (p Provider) Validate() error {
	switch p {
	case ProviderPostgres:
		return nil
	default:
		return fmt.Errorf("unsupported provider: %s", p)
	}
}
