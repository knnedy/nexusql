package db

var postgresTypeMap = map[string]FieldType{
	"int2":      FieldTypeSmallint,
	"int4":      FieldTypeInteger,
	"int8":      FieldTypeBigint,
	"serial":    FieldTypeSerial,
	"bigserial": FieldTypeBigserial,

	"numeric": FieldTypeNumeric,
	"float4":  FieldTypeReal,
	"float8":  FieldTypeDoublePrecision,

	"bpchar":  FieldTypeChar,
	"varchar": FieldTypeVarchar,
	"text":    FieldTypeText,

	"bool": FieldTypeBoolean,

	"uuid": FieldTypeUUID,

	"date":        FieldTypeDate,
	"time":        FieldTypeTime,
	"timestamp":   FieldTypeTimestamp,
	"timestamptz": FieldTypeTimestamptz,
	"interval":    FieldTypeInterval,

	"json":  FieldTypeJSON,
	"jsonb": FieldTypeJSONB,

	"bytea": FieldTypeBytea,
}

// normalizePostgresType translates a raw pg_catalog udt_name into the
// canonical FieldType. Unrecognized types are returned as-is so callers
// can fall back to enum lookups or display the raw name.
func normalizePostgresType(udtName string) FieldType {
	if ft, ok := postgresTypeMap[udtName]; ok {
		return ft
	}
	return FieldType(udtName)
}
