package mysql

import (
	"strings"

	"github.com/knnedy/nexusql/internal/db"
)

var typeMap = map[string]db.FieldType{
	"tinyint":   db.FieldTypeSmallint, // overridden to boolean for tinyint(1) in normalizeType
	"smallint":  db.FieldTypeSmallint,
	"mediumint": db.FieldTypeInteger,
	"int":       db.FieldTypeInteger,
	"integer":   db.FieldTypeInteger,
	"bigint":    db.FieldTypeBigint,
	"year":      db.FieldTypeSmallint,

	"decimal": db.FieldTypeNumeric,
	"numeric": db.FieldTypeNumeric,
	"float":   db.FieldTypeReal,
	"double":  db.FieldTypeDoublePrecision,

	"char":       db.FieldTypeChar,
	"varchar":    db.FieldTypeVarchar,
	"tinytext":   db.FieldTypeText,
	"text":       db.FieldTypeText,
	"mediumtext": db.FieldTypeText,
	"longtext":   db.FieldTypeText,

	"date":      db.FieldTypeDate,
	"time":      db.FieldTypeTime,
	"datetime":  db.FieldTypeTimestamp,
	"timestamp": db.FieldTypeTimestamptz,

	"json": db.FieldTypeJSON,

	"binary":     db.FieldTypeBytea,
	"varbinary":  db.FieldTypeBytea,
	"tinyblob":   db.FieldTypeBytea,
	"blob":       db.FieldTypeBytea,
	"mediumblob": db.FieldTypeBytea,
	"longblob":   db.FieldTypeBytea,
}

func normalizeType(dataType, columnType string) db.FieldType {
	lower := strings.ToLower(dataType)
	lowerColType := strings.ToLower(columnType)

	switch lower {
	case "tinyint":
		if strings.HasPrefix(lowerColType, "tinyint(1)") {
			return db.FieldTypeBoolean
		}
		return db.FieldTypeSmallint
	case "bit":
		if lowerColType == "bit(1)" {
			return db.FieldTypeBoolean
		}
		return db.FieldTypeBytea
	}

	if ft, ok := typeMap[lower]; ok {
		return ft
	}
	return db.FieldType(lower)
}
