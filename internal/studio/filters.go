package studio

import (
	"fmt"
	"slices"
	"strconv"
	"strings"

	"github.com/knnedy/nexusql/internal/db"
)

// RowFilter is one client-supplied condition on a column of the queried table.
type RowFilter struct {
	Column string
	Op     string
	Values []string
}

const (
	maxFilters      = 20
	maxFilterValues = 100
)

type filterKind int

const (
	kindOther filterKind = iota
	kindText
	kindNumber
	kindTemporal
	kindBoolean
	kindChoice
	kindJSON
)

var (
	nullOps = []db.FilterOp{db.FilterIsNull, db.FilterNotNull}
	coreOps = append([]db.FilterOp{db.FilterEq, db.FilterNe}, nullOps...)
	kindOps = map[filterKind][]db.FilterOp{
		kindOther:    coreOps,
		kindText:     append([]db.FilterOp{db.FilterContains, db.FilterStartsWith}, coreOps...),
		kindNumber:   append([]db.FilterOp{db.FilterLt, db.FilterLte, db.FilterGt, db.FilterGte}, coreOps...),
		kindTemporal: append([]db.FilterOp{db.FilterLt, db.FilterLte, db.FilterGt, db.FilterGte}, coreOps...),
		kindBoolean:  append([]db.FilterOp{db.FilterIn}, coreOps...),
		kindChoice:   append([]db.FilterOp{db.FilterIn}, coreOps...),
		kindJSON:     nullOps,
	}
)

// kindOf classifies f for filtering; choices are the values an enum or CHECK IN allows.
func kindOf(sch *db.Schema, f db.Field) (filterKind, []string) {
	if len(f.Allowed) > 0 {
		return kindChoice, f.Allowed
	}
	for _, e := range sch.Enums {
		if db.FieldType(e.Name) == f.Type {
			return kindChoice, e.Values
		}
	}
	switch f.Type {
	case db.FieldTypeChar, db.FieldTypeVarchar, db.FieldTypeText, db.FieldTypeUUID:
		return kindText, nil
	case db.FieldTypeSmallint, db.FieldTypeInteger, db.FieldTypeBigint, db.FieldTypeSerial,
		db.FieldTypeBigserial, db.FieldTypeNumeric, db.FieldTypeReal, db.FieldTypeDoublePrecision:
		return kindNumber, nil
	case db.FieldTypeDate, db.FieldTypeTime, db.FieldTypeTimestamp, db.FieldTypeTimestamptz, db.FieldTypeInterval:
		return kindTemporal, nil
	case db.FieldTypeBoolean:
		return kindBoolean, nil
	case db.FieldTypeJSON, db.FieldTypeJSONB:
		return kindJSON, nil
	}
	return kindOther, nil
}

// resolveFilters checks client filters against t's introspected columns and
// what each column's type supports.
func resolveFilters(sch *db.Schema, t db.Table, in []RowFilter) ([]db.Filter, error) {
	if len(in) > maxFilters {
		return nil, invalid(fmt.Errorf("at most %d filters", maxFilters))
	}
	out := make([]db.Filter, 0, len(in))
	for _, rf := range in {
		f, err := field(t, rf.Column)
		if err != nil {
			return nil, err
		}
		op := db.FilterOp(rf.Op)
		kind, choices := kindOf(sch, f)
		if !slices.Contains(kindOps[kind], op) {
			return nil, invalid(fmt.Errorf("filter %q does not apply to %s (%s)", rf.Op, f.Name, f.Type))
		}
		if err := checkArity(op, len(rf.Values)); err != nil {
			return nil, invalid(fmt.Errorf("%s: %w", f.Name, err))
		}
		values := slices.Clone(rf.Values)
		for i, v := range values {
			switch kind {
			case kindNumber:
				if _, err := strconv.ParseFloat(strings.TrimSpace(v), 64); err != nil {
					return nil, invalid(fmt.Errorf("%s: %q is not a number", f.Name, v))
				}
			case kindBoolean:
				values[i] = strings.ToLower(v)
				if values[i] != "true" && values[i] != "false" {
					return nil, invalid(fmt.Errorf("%s: %q is not true or false", f.Name, v))
				}
			case kindChoice:
				if !slices.Contains(choices, v) {
					return nil, invalid(fmt.Errorf("%s: %q is not one of %s", f.Name, v, strings.Join(choices, ", ")))
				}
			}
		}
		out = append(out, db.Filter{Field: f, Op: op, Values: values})
	}
	return out, nil
}

func checkArity(op db.FilterOp, n int) error {
	switch {
	case slices.Contains(nullOps, op) && n != 0:
		return fmt.Errorf("%s takes no value", op)
	case op == db.FilterIn && (n < 1 || n > maxFilterValues):
		return fmt.Errorf("in takes 1 to %d values", maxFilterValues)
	case op != db.FilterIn && !slices.Contains(nullOps, op) && n != 1:
		return fmt.Errorf("%s takes one value", op)
	}
	return nil
}
