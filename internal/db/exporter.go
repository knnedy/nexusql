package db

import (
	"fmt"
	"regexp"
	"strings"
)

// Exporter gives the shared schema exporters (internal/export) the facts of
// one dialect; output structure and naming live there (ADR 0012).
type Exporter interface {
	// Drizzle names the dialect's drizzle-orm module and builders.
	Drizzle() DrizzleDialect
	// DrizzleColumn is the column builder call for a non-enum field, given its
	// name as a JS string literal, and the names it imports; "" means
	// unsupported (rendered as a customType of the declared type).
	DrizzleColumn(f Field, name string) (call string, imports []string)
	// PrismaProvider names the Prisma datasource provider.
	PrismaProvider() string
	// PrismaType maps a non-enum field to a Prisma scalar and an optional native
	// attribute such as "@db.VarChar(40)"; an empty scalar means Unsupported.
	PrismaType(f Field) (scalar, native string)
	// Default classifies the field's default expression.
	Default(f Field) Default
}

// DrizzleDialect describes one drizzle-orm dialect module.
type DrizzleDialect struct {
	Module     string // e.g. "drizzle-orm/pg-core"
	Table      string // table builder, e.g. "pgTable"
	AnyColumn  string // column type for typed references, e.g. "AnyPgColumn"
	Enum       string // enum builder; "" when the dialect has none
	NamedEnums bool   // enums are declared once and shared (pgEnum)
	DefaultNow bool   // timestamp columns take .defaultNow()
	BigInt     bool   // bigint columns hold JS bigint values
}

// DefaultKind classifies a column default for exporters.
type DefaultKind int

const (
	DefaultNone   DefaultKind = iota
	DefaultString             // Value is the unquoted text
	DefaultNumber             // Value is the number as written
	DefaultBool               // Value is "true" or "false"
	DefaultNow                // the current timestamp
	DefaultExpr               // Value is any other SQL expression
)

// Default is a column default, classified.
type Default struct {
	Kind  DefaultKind
	Value string
}

var number = regexp.MustCompile(`^-?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$`)

// ParseDefault classifies a default SQL expression that dialect-only syntax
// (such as Postgres casts) has already been stripped from.
func ParseDefault(expr string) Default {
	e := strings.TrimSpace(expr)
	u := strings.ToUpper(e)
	switch {
	case e == "" || u == "NULL":
		return Default{}
	case u == "TRUE" || u == "FALSE":
		return Default{DefaultBool, strings.ToLower(u)}
	case u == "CURRENT_TIMESTAMP" || u == "NOW()" || u == "LOCALTIMESTAMP" ||
		strings.HasPrefix(u, "CURRENT_TIMESTAMP(") && strings.HasSuffix(u, ")"):
		return Default{Kind: DefaultNow}
	case number.MatchString(e):
		return Default{DefaultNumber, e}
	}
	if s, ok := unquote(e); ok {
		return Default{DefaultString, s}
	}
	return Default{DefaultExpr, e}
}

// unquote reads a whole single-quoted SQL string, where ” is one quote.
func unquote(e string) (string, bool) {
	if len(e) < 2 || e[0] != '\'' || e[len(e)-1] != '\'' {
		return "", false
	}
	inner := e[1 : len(e)-1]
	if strings.Count(strings.ReplaceAll(inner, "''", ""), "'") > 0 {
		return "", false // several literals, e.g. 'a' || 'b'
	}
	return strings.ReplaceAll(inner, "''", "'"), true
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
