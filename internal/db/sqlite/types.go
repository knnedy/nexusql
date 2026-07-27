package sqlite

import (
	"strings"

	"github.com/knnedy/nexusql/internal/db"
)

// normalizeType maps a SQLite declared column type onto the canonical
// FieldType enum.
func normalizeType(declared string) db.FieldType {
	t := strings.ToUpper(strings.TrimSpace(declared))

	switch {
	case strings.Contains(t, "BOOL"):
		return db.FieldTypeBoolean
	case strings.Contains(t, "UUID"):
		return db.FieldTypeUUID
	case strings.Contains(t, "TIMESTAMP"), strings.Contains(t, "DATETIME"):
		return db.FieldTypeTimestamp
	case strings.Contains(t, "DATE"):
		return db.FieldTypeDate
	case strings.Contains(t, "TIME"):
		return db.FieldTypeTime
	case strings.Contains(t, "JSON"):
		return db.FieldTypeJSON
	case strings.Contains(t, "VARCHAR"):
		return db.FieldTypeVarchar
	case strings.Contains(t, "CHAR"):
		return db.FieldTypeChar
	case strings.Contains(t, "INT"):
		return db.FieldTypeInteger
	case strings.Contains(t, "CLOB"), strings.Contains(t, "TEXT"):
		return db.FieldTypeText
	case strings.Contains(t, "BLOB"), t == "":
		return db.FieldTypeBytea
	case strings.Contains(t, "REAL"), strings.Contains(t, "FLOA"):
		return db.FieldTypeReal
	case strings.Contains(t, "DOUB"):
		return db.FieldTypeDoublePrecision
	case strings.Contains(t, "DECIMAL"), strings.Contains(t, "NUMERIC"):
		return db.FieldTypeNumeric
	default:
		// SQLite's NUMERIC affinity catch-all — closest canonical match
		// for any declared type not matched above.
		return db.FieldTypeNumeric
	}
}
