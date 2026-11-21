package db

import (
	"encoding/hex"
	"encoding/json"
	"math"
	"strconv"
	"time"
)

// Cell values cross to the browser as JSON. Providers decode dialect types
// with these helpers so nothing is rounded, relabelled or silently re-encoded.

// maxSafeInt is the largest integer a JavaScript number holds exactly.
const maxSafeInt = 1<<53 - 1

// WireValue makes a generic driver value JSON-safe without losing information:
// unsafe integers and non-finite floats become strings, bytes become Hex.
func WireValue(v any) any {
	switch x := v.(type) {
	case int64:
		if x > maxSafeInt || x < -maxSafeInt {
			return strconv.FormatInt(x, 10)
		}
	case int:
		return WireValue(int64(x))
	case uint64:
		if x > maxSafeInt {
			return strconv.FormatUint(x, 10)
		}
	case float64:
		return wireFloat(x)
	case float32:
		return wireFloat(float64(x))
	case []byte:
		return Hex(x)
	case time.Time:
		return Instant(x)
	}
	return v
}

func wireFloat(f float64) any {
	switch {
	case math.IsNaN(f):
		return "NaN"
	case math.IsInf(f, 1):
		return "Infinity"
	case math.IsInf(f, -1):
		return "-Infinity"
	}
	return f
}

// Hex renders binary data the way Postgres prints bytea: \x followed by hex.
func Hex(b []byte) string { return `\x` + hex.EncodeToString(b) }

// Date renders a calendar date.
func Date(t time.Time) string { return t.Format("2006-01-02") }

// LocalTime renders a timestamp without a time zone, so it is not mislabelled UTC.
func LocalTime(t time.Time) string { return t.Format("2006-01-02T15:04:05.999999999") }

// Instant renders a time-zone-aware timestamp in UTC.
func Instant(t time.Time) string { return t.UTC().Format(time.RFC3339Nano) }

// JSONValue passes valid JSON through as JSON and anything else as text.
func JSONValue(b []byte) any {
	if json.Valid(b) {
		return json.RawMessage(b)
	}
	return string(b)
}
