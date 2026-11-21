package db

import "fmt"

// Exporter renders an introspected schema as ORM schema source for one dialect.
// It needs no live connection, so it is separate from Provider (ADR 0004).
type Exporter interface {
	Prisma(schema *Schema) string
	Drizzle(schema *Schema) string
}

var exporters = map[ProviderKind]Exporter{}

// RegisterExporter is called from a dialect package's init(), next to Register.
func RegisterExporter(kind ProviderKind, e Exporter) {
	exporters[kind] = e
}

// ExporterFor returns the registered exporter for kind.
func ExporterFor(kind ProviderKind) (Exporter, error) {
	e, ok := exporters[kind]
	if !ok {
		return nil, fmt.Errorf("schema export not supported for provider: %s", kind)
	}
	return e, nil
}
