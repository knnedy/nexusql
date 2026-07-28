package db

import "strings"

var migrationTables = map[string]bool{
	"goose_db_version":      true,
	"schema_migrations":     true,
	"flyway_schema_history": true,
	"_prisma_migrations":    true,
	"_sqlx_migrations":      true,
}

// IsUserTable reports whether a table is application data rather than a
// migration-tool bookkeeping table, so schema exporters can skip the latter.
func IsUserTable(name string) bool {
	return !migrationTables[name]
}

// BuildRelationLookup indexes relations by "sourceTable.sourceField" for
// O(1) lookup when walking a table's fields during export.
func BuildRelationLookup(relations []Relation) map[string]Relation {
	m := make(map[string]Relation, len(relations))
	for _, r := range relations {
		m[r.SourceTable+"."+r.SourceField] = r
	}
	return m
}

// BuildEnumSet indexes enum names for O(1) "is this FieldType actually an
// enum name" checks during export.
func BuildEnumSet(enums []EnumType) map[string]bool {
	m := make(map[string]bool, len(enums))
	for _, e := range enums {
		m[e.Name] = true
	}
	return m
}

// Capitalize upper-cases the first letter of s, used to turn snake_case
// table/enum names into PascalCase model names for Prisma output.
func Capitalize(s string) string {
	if s == "" {
		return ""
	}
	return strings.ToUpper(s[:1]) + s[1:]
}
