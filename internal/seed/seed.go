// Package seed fills a connected database with fake rows in foreign-key order.
package seed

import (
	"context"
	"fmt"
	mrand "math/rand"
	"strings"

	"github.com/brianvoe/gofakeit/v7"
	"github.com/knnedy/nexusql/internal/db"
)

type Options struct {
	RowsPerTable int
	NullChance   float64 // probability [0,1] a nullable, non-key column gets NULL
}

type Result struct {
	RowsInserted map[string]int    // table -> rows inserted
	Skipped      map[string]int    // table -> rows the database rejected on every try
	Problems     map[string]string // table -> why its last row was rejected
}

// TopoSortTables orders tables so every table appears after all tables it
// has a (non-self-referential) foreign key into.
func TopoSortTables(schema *db.Schema) ([]string, error) {
	inDegree := map[string]int{}
	adj := map[string][]string{}
	exists := map[string]bool{}

	for _, t := range schema.Tables {
		exists[t.Name] = true
		inDegree[t.Name] = 0
	}

	seenEdge := map[string]bool{}
	for _, r := range schema.Relations {
		if r.SourceTable == r.TargetTable {
			continue
		}
		if !exists[r.SourceTable] || !exists[r.TargetTable] {
			continue
		}
		edgeKey := r.TargetTable + "->" + r.SourceTable
		if seenEdge[edgeKey] {
			continue
		}
		seenEdge[edgeKey] = true
		adj[r.TargetTable] = append(adj[r.TargetTable], r.SourceTable)
		inDegree[r.SourceTable]++
	}

	var queue []string
	for name, deg := range inDegree {
		if deg == 0 {
			queue = append(queue, name)
		}
	}
	sortStrings(queue)

	var order []string
	for len(queue) > 0 {
		n := queue[0]
		queue = queue[1:]
		order = append(order, n)

		var next []string
		for _, m := range adj[n] {
			inDegree[m]--
			if inDegree[m] == 0 {
				next = append(next, m)
			}
		}
		sortStrings(next)
		queue = append(queue, next...)
	}

	if len(order) != len(exists) {
		var stuck []string
		for name, deg := range inDegree {
			if deg > 0 {
				stuck = append(stuck, name)
			}
		}
		sortStrings(stuck)
		return nil, fmt.Errorf("cyclic foreign key dependency involving: %s", strings.Join(stuck, ", "))
	}

	return order, nil
}

func sortStrings(s []string) {
	for i := 1; i < len(s); i++ {
		for j := i; j > 0 && s[j-1] > s[j]; j-- {
			s[j-1], s[j] = s[j], s[j-1]
		}
	}
}

// maxAttempts bounds how often a row the database rejects (unique or check
// constraint) is regenerated before it is skipped and reported.
const maxAttempts = 5

// Run inserts fake rows into every table in foreign-key order, in one
// transaction, with values sent as parameters and converted like cell edits.
func Run(ctx context.Context, provider db.Provider, schema *db.Schema, opts Options) (*Result, error) {
	if opts.RowsPerTable <= 0 {
		return nil, fmt.Errorf("rowsPerTable must be positive")
	}

	order, err := TopoSortTables(schema)
	if err != nil {
		return nil, err
	}

	tablesByName := map[string]db.Table{}
	for _, t := range schema.Tables {
		tablesByName[t.Name] = t
	}
	enumsByName := map[string]db.EnumType{}
	for _, e := range schema.Enums {
		enumsByName[e.Name] = e
	}
	fkByField := map[string]db.Relation{}
	for _, r := range schema.Relations {
		if !r.IsComposite() { // composite keys are seeded as plain columns for now
			fkByField[r.SourceTable+"."+r.SourceField] = r
		}
	}

	tx, err := provider.BeginSeedTx(ctx)
	if err != nil {
		return nil, err
	}
	committed := false
	defer func() {
		if !committed {
			_ = tx.Rollback(ctx)
		}
	}()

	g := generator{fks: fkByField, enums: enumsByName, nullChance: opts.NullChance, pks: map[string][]string{}}
	result := &Result{RowsInserted: map[string]int{}, Skipped: map[string]int{}, Problems: map[string]string{}}

	for _, tableName := range order {
		table := tablesByName[tableName]
		pk := findPKField(table)
		for i := 0; i < opts.RowsPerTable; i++ {
			pkValue, err := g.insertRow(ctx, tx, table, pk)
			if ctx.Err() != nil {
				return nil, ctx.Err()
			}
			if err != nil {
				result.Skipped[tableName]++
				result.Problems[tableName] = err.Error()
				continue
			}
			result.RowsInserted[tableName]++
			if pk != nil {
				g.pks[tableName] = append(g.pks[tableName], pkValue)
			}
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit seed transaction: %w", err)
	}
	committed = true
	return result, nil
}

func findPKField(table db.Table) *db.Field {
	for i := range table.Fields {
		if table.Fields[i].IsPrimaryKey {
			return &table.Fields[i]
		}
	}
	return nil
}

type generator struct {
	fks        map[string]db.Relation
	enums      map[string]db.EnumType
	nullChance float64
	pks        map[string][]string // table -> primary key of every row inserted so far
}

// insertRow inserts one row, regenerating it when the database rejects it,
// and returns its primary key value ("" when it has none).
func (g *generator) insertRow(ctx context.Context, tx db.SeedTx, table db.Table, pk *db.Field) (string, error) {
	var lastErr error
	for range maxAttempts {
		fields, values, err := g.row(table)
		if err != nil {
			return "", err // retrying cannot help
		}
		var auto []db.Field
		if pk != nil && pk.AutoGenerated {
			auto = []db.Field{*pk}
		}
		got, err := tx.Insert(ctx, table, fields, values, auto)
		if err == nil {
			if len(got) == 1 {
				return got[0], nil
			}
			for i, f := range fields {
				if pk != nil && f.Name == pk.Name && values[i] != nil {
					return *values[i], nil
				}
			}
			return "", nil
		}
		lastErr = err
		if ctx.Err() != nil {
			break
		}
	}
	return "", lastErr
}

// row generates one row's fields and text values; auto-generated columns are
// left to the database.
func (g *generator) row(table db.Table) ([]db.Field, []*string, error) {
	var fields []db.Field
	var values []*string
	for _, f := range table.Fields {
		if f.AutoGenerated {
			continue
		}
		var v *string
		switch rel, isFK := g.fks[table.Name+"."+f.Name]; {
		case f.IsPrimaryKey:
			s := generatePKValue(f)
			v = &s
		case isFK && rel.TargetTable == table.Name:
			if !f.Nullable {
				continue // no earlier row to point at; leave it to a default
			}
		case isFK:
			parents := g.pks[rel.TargetTable]
			switch {
			case len(parents) > 0:
				v = &parents[mrand.Intn(len(parents))]
			case !f.Nullable:
				return nil, nil, fmt.Errorf("no rows in %s for %s.%s to reference", rel.TargetTable, table.Name, f.Name)
			}
		case f.Nullable && mrand.Float64() < g.nullChance:
		default:
			s := GenerateFakeValue(f, g.enums)
			v = &s
		}
		fields = append(fields, f)
		values = append(values, v)
	}
	return fields, values, nil
}

// generatePKValue returns a client-generated primary key value as text.
func generatePKValue(f db.Field) string {
	switch f.Type {
	case db.FieldTypeUUID, db.FieldTypeText, db.FieldTypeVarchar, db.FieldTypeChar:
		return gofakeit.UUID()
	default:
		// integer-ish PK with no sequence/default behind it
		return fmt.Sprintf("%d", gofakeit.Number(100000, 9999999))
	}
}

// GenerateFakeValue returns a fake value for f as text: an enum member, then a
// value fitting the column name, then one fitting the type.
func GenerateFakeValue(f db.Field, enums map[string]db.EnumType) string {
	if enum, ok := enums[string(f.Type)]; ok && len(enum.Values) > 0 {
		return gofakeit.RandomString(enum.Values)
	}
	if v, ok := generateByColumnName(f); ok {
		return v
	}
	switch f.Type {
	case db.FieldTypeSerial, db.FieldTypeBigserial, db.FieldTypeInteger, db.FieldTypeBigint, db.FieldTypeSmallint:
		return fmt.Sprintf("%d", gofakeit.Number(1, 10000))
	case db.FieldTypeNumeric, db.FieldTypeReal, db.FieldTypeDoublePrecision:
		return fmt.Sprintf("%.2f", gofakeit.Float64Range(0, 999)) // fits NUMERIC(5,2)
	case db.FieldTypeBoolean:
		return fmt.Sprintf("%v", gofakeit.Bool())
	case db.FieldTypeUUID:
		return gofakeit.UUID()
	case db.FieldTypeDate:
		return gofakeit.Date().Format("2006-01-02")
	case db.FieldTypeTime:
		return gofakeit.Date().Format("15:04:05")
	case db.FieldTypeTimestamp:
		return gofakeit.Date().Format("2006-01-02 15:04:05")
	case db.FieldTypeTimestamptz:
		return gofakeit.Date().Format("2006-01-02 15:04:05-07")
	case db.FieldTypeInterval:
		return fmt.Sprintf("%d days", gofakeit.Number(1, 30))
	case db.FieldTypeJSON, db.FieldTypeJSONB:
		return fmt.Sprintf(`{"seed": %d}`, gofakeit.Number(1, 1000))
	case db.FieldTypeBytea:
		return fmt.Sprintf(`\x%x`, gofakeit.LetterN(16))
	case db.FieldTypeChar:
		return gofakeit.Letter()
	case db.FieldTypeText:
		return gofakeit.Sentence(8)
	default: // varchar and anything else string-shaped
		return gofakeit.Word()
	}
}

func generateByColumnName(f db.Field) (string, bool) {
	if !isStringType(f.Type) {
		return "", false
	}
	name := strings.ToLower(f.Name)

	switch {
	case strings.Contains(name, "email"):
		return gofakeit.Email(), true
	case strings.Contains(name, "first_name") || name == "firstname":
		return gofakeit.FirstName(), true
	case strings.Contains(name, "last_name") || name == "lastname":
		return gofakeit.LastName(), true
	case name == "name" || strings.HasSuffix(name, "_name"):
		return gofakeit.Name(), true
	case strings.Contains(name, "username"):
		return gofakeit.Username(), true
	case strings.Contains(name, "phone"):
		return gofakeit.Phone(), true
	case strings.Contains(name, "company"):
		return gofakeit.Company(), true
	case strings.Contains(name, "address") && !strings.Contains(name, "email"):
		return gofakeit.Street(), true
	case strings.Contains(name, "city"):
		return gofakeit.City(), true
	case strings.Contains(name, "state"):
		return gofakeit.State(), true
	case strings.Contains(name, "country"):
		return gofakeit.Country(), true
	case strings.Contains(name, "zip") || strings.Contains(name, "postal"):
		return gofakeit.Zip(), true
	case strings.Contains(name, "url") || strings.Contains(name, "website"):
		return gofakeit.URL(), true
	case strings.Contains(name, "title"):
		return gofakeit.JobTitle(), true
	case strings.Contains(name, "description") || strings.Contains(name, "bio"):
		return gofakeit.Sentence(12), true
	case strings.Contains(name, "slug"):
		return strings.ToLower(gofakeit.Word() + "-" + gofakeit.Word()), true
	case strings.Contains(name, "color"):
		return gofakeit.Color(), true
	case strings.Contains(name, "currency"):
		return gofakeit.CurrencyShort(), true
	case strings.Contains(name, "avatar") || strings.Contains(name, "image") || strings.Contains(name, "photo"):
		return gofakeit.URL(), true
	}
	return "", false
}

func isStringType(t db.FieldType) bool {
	switch t {
	case db.FieldTypeChar, db.FieldTypeVarchar, db.FieldTypeText:
		return true
	default:
		return false
	}
}
