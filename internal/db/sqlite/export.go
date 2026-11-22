package sqlite

import (
	"strings"

	"github.com/knnedy/nexusql/internal/db"
)

// exporter gives the shared exporters SQLite's types and defaults.
type exporter struct{}

func (exporter) Drizzle() db.DrizzleDialect {
	return db.DrizzleDialect{Module: "drizzle-orm/sqlite-core", Table: "sqliteTable", AnyColumn: "AnySQLiteColumn", AutoIncrementPK: true}
}

// DrizzleColumn follows storage: dates SQLite stores as text stay text.
func (exporter) DrizzleColumn(f db.Field, name string) (string, []string) {
	call := func(builder string, opts ...string) (string, []string) {
		if len(opts) == 0 {
			return builder + "(" + name + ")", []string{builder}
		}
		return builder + "(" + name + ", { " + strings.Join(opts, ", ") + " })", []string{builder}
	}
	switch f.Type {
	case db.FieldTypeSmallint, db.FieldTypeInteger, db.FieldTypeSerial, db.FieldTypeBigint, db.FieldTypeBigserial:
		return call("integer")
	case db.FieldTypeBoolean:
		return call("integer", "mode: 'boolean'")
	case db.FieldTypeReal, db.FieldTypeDoublePrecision:
		return call("real")
	case db.FieldTypeNumeric:
		return call("numeric")
	case db.FieldTypeJSON, db.FieldTypeJSONB:
		return call("text", "mode: 'json'")
	case db.FieldTypeBytea:
		return call("blob")
	case db.FieldTypeVarchar, db.FieldTypeText, db.FieldTypeChar, db.FieldTypeUUID,
		db.FieldTypeDate, db.FieldTypeTime, db.FieldTypeTimestamp, db.FieldTypeTimestamptz:
		if len(f.Allowed) > 0 {
			vals := make([]string, len(f.Allowed))
			for i, v := range f.Allowed {
				vals[i] = db.JSString(v)
			}
			return call("text", "enum: ["+strings.Join(vals, ", ")+"]")
		}
		return call("text")
	}
	return "", nil
}

func (exporter) PrismaProvider() string { return "sqlite" }

// PrismaType maps by affinity; the SQLite connector has no native type attributes.
func (exporter) PrismaType(f db.Field) (string, string) {
	switch f.Type {
	case db.FieldTypeSmallint, db.FieldTypeInteger, db.FieldTypeSerial:
		return "Int", ""
	case db.FieldTypeBigint, db.FieldTypeBigserial:
		return "BigInt", ""
	case db.FieldTypeNumeric:
		return "Decimal", ""
	case db.FieldTypeReal, db.FieldTypeDoublePrecision:
		return "Float", ""
	case db.FieldTypeVarchar, db.FieldTypeText, db.FieldTypeChar, db.FieldTypeUUID:
		return "String", ""
	case db.FieldTypeBoolean:
		return "Boolean", ""
	case db.FieldTypeTimestamp, db.FieldTypeTimestamptz, db.FieldTypeDate, db.FieldTypeTime:
		return "DateTime", ""
	case db.FieldTypeJSON, db.FieldTypeJSONB:
		return "Json", ""
	case db.FieldTypeBytea:
		return "Bytes", ""
	}
	return "", ""
}

func (exporter) Default(f db.Field) db.Default {
	if f.DefaultValue == nil {
		return db.Default{}
	}
	return db.ParseDefault(*f.DefaultValue)
}

func (exporter) SQL() db.SQLDialect { return db.SQLDialect{Quote: '"', InlineForeignKeys: true} }

// SQLColumnType keeps the declared type: it sets the column's affinity, and
// INTEGER PRIMARY KEY makes the rowid alias.
func (exporter) SQLColumnType(f db.Field) (string, bool) { return f.NativeType, true }

// KyselyType follows storage, as better-sqlite3 returns it: dates and JSON
// are text, booleans are integers.
func (exporter) KyselyType(f db.Field) string {
	switch f.Type {
	case db.FieldTypeSmallint, db.FieldTypeInteger, db.FieldTypeSerial, db.FieldTypeBigint,
		db.FieldTypeBigserial, db.FieldTypeReal, db.FieldTypeDoublePrecision, db.FieldTypeNumeric, db.FieldTypeBoolean:
		return "number"
	case db.FieldTypeBytea:
		return "Buffer"
	case "":
		return ""
	}
	return "string"
}

// typeormTypes are the type names TypeORM's SQLite drivers accept.
var typeormTypes = map[string]bool{"int": true, "integer": true, "tinyint": true, "smallint": true,
	"mediumint": true, "bigint": true, "unsigned big int": true, "int2": true, "int8": true,
	"character": true, "varchar": true, "varying character": true, "nchar": true, "native character": true,
	"nvarchar": true, "text": true, "clob": true, "blob": true, "real": true, "double": true,
	"double precision": true, "float": true, "numeric": true, "decimal": true, "boolean": true,
	"date": true, "time": true, "datetime": true, "json": true, "jsonb": true}

// TypeORM maps a declared type TypeORM rejects to one with the same affinity.
func (exporter) TypeORM(f db.Field) db.TypeORMColumn {
	c := db.TypeORMColumn{TS: typeormTS(f)}
	base, args := db.TypeArgs(f.NativeType)
	if typeormTypes[base] {
		return c
	}
	u := strings.ToUpper(base)
	switch {
	case strings.Contains(u, "INT"):
		c.Type = "integer"
	case base == "char":
		c.Type = "character"
	case strings.Contains(u, "CHAR") || strings.Contains(u, "CLOB") || strings.Contains(u, "TEXT"):
		c.Type = "text"
		if len(args) > 0 {
			c.Type = "varchar"
		}
	case base == "" || strings.Contains(u, "BLOB"):
		c.Type = "blob"
	case strings.Contains(u, "REAL") || strings.Contains(u, "FLOA") || strings.Contains(u, "DOUB"):
		c.Type = "real"
	default:
		c.Type = "numeric"
	}
	return c
}

// typeormTS: TypeORM's SQLite drivers return numbers for every numeric type,
// convert boolean and datetime columns, and leave other dates as text.
func typeormTS(f db.Field) string {
	base, _ := db.TypeArgs(f.NativeType)
	switch f.Type {
	case db.FieldTypeSmallint, db.FieldTypeInteger, db.FieldTypeSerial, db.FieldTypeBigint,
		db.FieldTypeBigserial, db.FieldTypeReal, db.FieldTypeDoublePrecision, db.FieldTypeNumeric:
		return "number"
	case db.FieldTypeBoolean:
		if base == "boolean" {
			return "boolean"
		}
		return "number"
	case db.FieldTypeTimestamp:
		if base == "datetime" {
			return "Date"
		}
		return "string"
	case db.FieldTypeBytea:
		return "Buffer"
	case db.FieldTypeJSON, "":
		return ""
	}
	return "string"
}
