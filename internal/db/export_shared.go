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

// BuildRelationLookup indexes single-column relations by "sourceTable.sourceField";
// the Drizzle exporters cannot express composite keys yet, so those are left out.
func BuildRelationLookup(relations []Relation) map[string]Relation {
	m := make(map[string]Relation, len(relations))
	for _, r := range relations {
		if !r.IsComposite() {
			m[r.SourceTable+"."+r.SourceField] = r
		}
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

// TypeArgs splits a declared type such as "numeric(10,2)" or "timestamp(3)
// with time zone" into its lower-cased name without arguments and the arguments.
func TypeArgs(native string) (string, []string) {
	n := strings.ToLower(strings.TrimSpace(native))
	open, end := strings.IndexByte(n, '('), strings.IndexByte(n, ')')
	if open < 0 || end < open {
		return n, nil
	}
	var args []string
	for _, a := range strings.Split(n[open+1:end], ",") {
		args = append(args, strings.TrimSpace(a))
	}
	return strings.TrimSpace(strings.Join(strings.Fields(n[:open]+" "+n[end+1:]), " ")), args
}
