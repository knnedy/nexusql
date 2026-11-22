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
