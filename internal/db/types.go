package db

type FieldType string

const (
	FieldTypeSerial          FieldType = "serial"
	FieldTypeBigserial       FieldType = "bigserial"
	FieldTypeSmallint        FieldType = "smallint"
	FieldTypeInteger         FieldType = "integer"
	FieldTypeBigint          FieldType = "bigint"
	FieldTypeNumeric         FieldType = "numeric"
	FieldTypeReal            FieldType = "real"
	FieldTypeDoublePrecision FieldType = "double precision"
	FieldTypeChar            FieldType = "char"
	FieldTypeVarchar         FieldType = "varchar"
	FieldTypeText            FieldType = "text"
	FieldTypeBoolean         FieldType = "boolean"
	FieldTypeUUID            FieldType = "uuid"
	FieldTypeDate            FieldType = "date"
	FieldTypeTime            FieldType = "time"
	FieldTypeTimestamp       FieldType = "timestamp"
	FieldTypeTimestamptz     FieldType = "timestamptz"
	FieldTypeInterval        FieldType = "interval"
	FieldTypeJSON            FieldType = "json"
	FieldTypeJSONB           FieldType = "jsonb"
	FieldTypeBytea           FieldType = "bytea"
)

type SortDir string

const (
	SortAsc  SortDir = "asc"
	SortDesc SortDir = "desc"
)

type Field struct {
	Name         string    `json:"name"`
	Type         FieldType `json:"type"`
	Nullable     bool      `json:"nullable"`
	IsPrimaryKey bool      `json:"isPrimaryKey"`
	IsForeignKey bool      `json:"isForeignKey"`
	DefaultValue *string   `json:"defaultValue"`
}

type Table struct {
	Name   string  `json:"name"`
	Schema string  `json:"schema"`
	Fields []Field `json:"fields"`
}

type Relation struct {
	ConstraintName string `json:"constraintName"`
	SourceTable    string `json:"sourceTable"`
	SourceField    string `json:"sourceField"`
	TargetTable    string `json:"targetTable"`
	TargetField    string `json:"targetField"`
}

type EnumType struct {
	Name   string   `json:"name"`
	Values []string `json:"values"`
}

type Schema struct {
	Tables    []Table    `json:"tables"`
	Relations []Relation `json:"relations"`
	Enums     []EnumType `json:"enums"`
}
