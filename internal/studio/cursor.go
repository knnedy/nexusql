package studio

import (
	"fmt"
	"strconv"

	"github.com/knnedy/nexusql/internal/db"
)

// keysetOrder reports whether req's order can page by cursor: a primary key
// breaks ties, no order column holds NULL, and each one's text compares exactly.
func keysetOrder(req db.RowsRequest) bool {
	fields := req.OrderFields()
	hasKey := false
	for _, f := range fields {
		hasKey = hasKey || f.IsPrimaryKey
		if f.Nullable || !exactText(f.Type) {
			return false
		}
	}
	return hasKey
}

func exactText(t db.FieldType) bool {
	switch t {
	case db.FieldTypeSmallint, db.FieldTypeInteger, db.FieldTypeBigint, db.FieldTypeSerial,
		db.FieldTypeBigserial, db.FieldTypeChar, db.FieldTypeVarchar, db.FieldTypeText,
		db.FieldTypeUUID, db.FieldTypeDate:
		return true
	}
	return false
}

func isInteger(t db.FieldType) bool {
	switch t {
	case db.FieldTypeSmallint, db.FieldTypeInteger, db.FieldTypeBigint, db.FieldTypeSerial, db.FieldTypeBigserial:
		return true
	}
	return false
}

// checkCursor rejects a cursor that does not fit req's order columns.
func checkCursor(req db.RowsRequest, after []string) error {
	fields := req.OrderFields()
	if len(after) != len(fields) {
		return invalid(fmt.Errorf("cursor has %d values, the order has %d columns", len(after), len(fields)))
	}
	for i, f := range fields {
		if isInteger(f.Type) {
			if _, err := strconv.ParseInt(after[i], 10, 64); err != nil {
				return invalid(fmt.Errorf("cursor value %q for %s is not an integer", after[i], f.Name))
			}
		}
	}
	return nil
}

// cursorOf is row's values of req's order columns, as text; nil if one cannot be written exactly.
func cursorOf(req db.RowsRequest, row map[string]any) []string {
	fields := req.OrderFields()
	out := make([]string, len(fields))
	for i, f := range fields {
		switch v := row[f.Name].(type) {
		case string:
			out[i] = v
		case int64:
			out[i] = strconv.FormatInt(v, 10)
		case int32:
			out[i] = strconv.FormatInt(int64(v), 10)
		case int16:
			out[i] = strconv.FormatInt(int64(v), 10)
		case int:
			out[i] = strconv.Itoa(v)
		case uint64:
			out[i] = strconv.FormatUint(v, 10)
		default:
			return nil
		}
	}
	return out
}
