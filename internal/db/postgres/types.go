package postgres

import "github.com/knnedy/nexusql/internal/db"

var typeMap = map[string]db.FieldType{
	"int2":      db.FieldTypeSmallint,
	"int4":      db.FieldTypeInteger,
	"int8":      db.FieldTypeBigint,
	"serial":    db.FieldTypeSerial,
	"bigserial": db.FieldTypeBigserial,

	"numeric": db.FieldTypeNumeric,
	"float4":  db.FieldTypeReal,
	"float8":  db.FieldTypeDoublePrecision,

	"bpchar":  db.FieldTypeChar,
	"varchar": db.FieldTypeVarchar,
	"text":    db.FieldTypeText,

	"bool": db.FieldTypeBoolean,

	"uuid": db.FieldTypeUUID,

	"date":        db.FieldTypeDate,
	"time":        db.FieldTypeTime,
	"timestamp":   db.FieldTypeTimestamp,
	"timestamptz": db.FieldTypeTimestamptz,
	"interval":    db.FieldTypeInterval,

	"json":  db.FieldTypeJSON,
	"jsonb": db.FieldTypeJSONB,

	"bytea": db.FieldTypeBytea,
}

// normalizeType translates a raw pg_catalog udt_name into the canonical
// db.FieldType. Unrecognized types (custom domains, extensions, or enum
// type names) are returned as-is so callers can fall back to enum lookups
// or display the raw name.
func normalizeType(udtName string) db.FieldType {
	if ft, ok := typeMap[udtName]; ok {
		return ft
	}
	return db.FieldType(udtName)
}
