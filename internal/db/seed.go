package db

import (
	"context"
	"fmt"
	mrand "math/rand"
	"strings"

	"github.com/brianvoe/gofakeit/v7"
)

type SeedOptions struct {
	RowsPerTable int
	NullChance   float64 // probability [0,1] a nullable, non-key column gets NULL
}

type SeedResult struct {
	RowsInserted map[string]int // tableName -> rows inserted
}

// TopoSortTables orders tables so every table appears after all tables it
// has a (non-self-referential) foreign key into.
func TopoSortTables(schema *Schema) ([]string, error) {
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

// RunSeed generates and inserts fake rows for every table in schema, in FK
// dependency order, inside a single transaction. Primary keys are captured
// via RETURNING as each row is inserted, so serial/bigserial sequences stay
// correct and child tables always reference real parent PKs.
func RunSeed(ctx context.Context, provider Provider, schema *Schema, opts SeedOptions) (*SeedResult, error) {
	if opts.RowsPerTable <= 0 {
		return nil, fmt.Errorf("rowsPerTable must be positive")
	}

	order, err := TopoSortTables(schema)
	if err != nil {
		return nil, err
	}

	tablesByName := map[string]Table{}
	for _, t := range schema.Tables {
		tablesByName[t.Name] = t
	}
	enumsByName := map[string]EnumType{}
	for _, e := range schema.Enums {
		enumsByName[e.Name] = e
	}
	fkByField := map[string]Relation{}
	for _, r := range schema.Relations {
		fkByField[r.SourceTable+"."+r.SourceField] = r
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

	generatedPKs := map[string][]string{}
	result := &SeedResult{RowsInserted: map[string]int{}}

	for _, tableName := range order {
		table := tablesByName[tableName]
		pkField := findPKField(table)

		var insertedThisTable []string
		for i := 0; i < opts.RowsPerTable; i++ {
			sql, hasPK := buildInsertSQL(table, fkByField, generatedPKs, enumsByName, opts.NullChance)

			if pkField != nil && hasPK {
				pkVal, err := tx.InsertReturningPK(ctx, sql, pkField.Name)
				if err != nil {
					return nil, fmt.Errorf("table %s row %d: %w", tableName, i, err)
				}
				insertedThisTable = append(insertedThisTable, pkVal)
			} else {
				if err := tx.Exec(ctx, sql); err != nil {
					return nil, fmt.Errorf("table %s row %d: %w", tableName, i, err)
				}
			}
			result.RowsInserted[tableName]++
		}

		generatedPKs[tableName] = insertedThisTable
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit seed transaction: %w", err)
	}
	committed = true

	return result, nil
}

func findPKField(table Table) *Field {
	for i := range table.Fields {
		if table.Fields[i].IsPrimaryKey {
			return &table.Fields[i]
		}
	}
	return nil
}

// buildInsertSQL builds "INSERT INTO t (cols) VALUES (vals)" with no
// RETURNING clause (the caller appends that). The PK column is omitted
// entirely from the statement so the database (sequence/default) assigns
// it — we only ever read PKs back via RETURNING, never write them.
func buildInsertSQL(table Table, fkByField map[string]Relation, generatedPKs map[string][]string, enums map[string]EnumType, nullChance float64) (sql string, hasPK bool) {
	var cols, vals []string

	for _, f := range table.Fields {
		if f.IsPrimaryKey {
			hasPK = true
			if f.DefaultValue != nil {
				// DB has a default (serial sequence, gen_random_uuid(), etc.) —
				// omit the column and let the DB assign it; we read it back
				// via RETURNING either way.
				continue
			}
			// No DB-level default — we have to supply a value ourselves or
			// Postgres will send NULL through and violate NOT NULL.
			cols = append(cols, quoteIdent(f.Name))
			vals = append(vals, generatePKValue(f))
			continue
		}

		var v string
		if f.IsForeignKey {
			rel, ok := fkByField[table.Name+"."+f.Name]
			switch {
			case !ok:
				v = valueOrNull(f, enums, nullChance)
			case rel.TargetTable == table.Name:
				// Self-referential FK — no earlier row in *this* insert to
				// reference, so leave NULL if allowed, otherwise skip fake data
				// and let it default.
				if f.Nullable {
					v = "NULL"
				} else {
					continue // omit column, let DB default apply if any
				}
			default:
				parentVals := generatedPKs[rel.TargetTable]
				if len(parentVals) == 0 {
					if f.Nullable {
						v = "NULL"
					} else {
						continue // no valid parent to reference; omit and hope for a default
					}
				} else {
					v = parentVals[mrand.Intn(len(parentVals))]
					if needsQuoting(f.Type) {
						v = quoteLiteral(strings.Trim(v, "'"))
					}
				}
			}
		} else {
			v = valueOrNull(f, enums, nullChance)
		}

		cols = append(cols, quoteIdent(f.Name))
		vals = append(vals, v)
	}

	if len(cols) == 0 {
		return fmt.Sprintf("INSERT INTO %s DEFAULT VALUES", quoteTable(table)), hasPK
	}

	return fmt.Sprintf(
		"INSERT INTO %s (%s) VALUES (%s)",
		quoteTable(table),
		strings.Join(cols, ", "),
		strings.Join(vals, ", "),
	), hasPK
}

func generatePKValue(f Field) string {
	switch f.Type {
	case FieldTypeUUID:
		return quoteLiteral(gofakeit.UUID())
	case FieldTypeText, FieldTypeVarchar, FieldTypeChar:
		return quoteLiteral(gofakeit.UUID())
	default:
		// integer-ish PK with no sequence/default behind it
		return fmt.Sprintf("%d", gofakeit.Number(100000, 9999999))
	}
}

func needsQuoting(t FieldType) bool {
	switch t {
	case FieldTypeUUID, FieldTypeText, FieldTypeVarchar, FieldTypeChar:
		return true
	default:
		return false
	}
}

func valueOrNull(f Field, enums map[string]EnumType, nullChance float64) string {
	if f.Nullable && mrand.Float64() < nullChance {
		return "NULL"
	}
	return GenerateFakeValue(f, enums)
}

func quoteIdent(name string) string {
	return `"` + strings.ReplaceAll(name, `"`, `""`) + `"`
}

func quoteTable(t Table) string {
	if t.Schema == "" {
		return quoteIdent(t.Name)
	}
	return quoteIdent(t.Schema) + "." + quoteIdent(t.Name)
}

func quoteLiteral(s string) string {
	return "'" + strings.ReplaceAll(s, "'", "''") + "'"
}

// GenerateFakeValue is unchanged from the GoFakeIt version — enum match,
// then column-name sniffing, then type-based fallback.
func GenerateFakeValue(f Field, enums map[string]EnumType) string {
	if enum, ok := enums[string(f.Type)]; ok && len(enum.Values) > 0 {
		return quoteLiteral(gofakeit.RandomString(enum.Values))
	}
	if v, ok := generateByColumnName(f); ok {
		return v
	}
	switch f.Type {
	case FieldTypeSerial, FieldTypeBigserial, FieldTypeInteger, FieldTypeBigint, FieldTypeSmallint:
		return fmt.Sprintf("%d", gofakeit.Number(1, 10000))
	case FieldTypeNumeric, FieldTypeReal, FieldTypeDoublePrecision:
		return fmt.Sprintf("%.2f", gofakeit.Float64Range(0, 10000))
	case FieldTypeBoolean:
		return fmt.Sprintf("%v", gofakeit.Bool())
	case FieldTypeUUID:
		return quoteLiteral(gofakeit.UUID())
	case FieldTypeDate:
		return quoteLiteral(gofakeit.Date().Format("2006-01-02"))
	case FieldTypeTime:
		return quoteLiteral(gofakeit.Date().Format("15:04:05"))
	case FieldTypeTimestamp:
		return quoteLiteral(gofakeit.Date().Format("2006-01-02 15:04:05"))
	case FieldTypeTimestamptz:
		return quoteLiteral(gofakeit.Date().Format("2006-01-02 15:04:05-07"))
	case FieldTypeInterval:
		return quoteLiteral(fmt.Sprintf("%d days", gofakeit.Number(1, 30)))
	case FieldTypeJSON, FieldTypeJSONB:
		return quoteLiteral(fmt.Sprintf(`{"seed": %d}`, gofakeit.Number(1, 1000)))
	case FieldTypeBytea:
		return quoteLiteral(fmt.Sprintf(`\x%x`, gofakeit.LetterN(16)))
	case FieldTypeChar:
		return quoteLiteral(gofakeit.Letter())
	case FieldTypeText:
		return quoteLiteral(gofakeit.Sentence(8))
	default: // varchar and anything else string-shaped
		return quoteLiteral(gofakeit.Word())
	}
}

func generateByColumnName(f Field) (string, bool) {
	if !isStringType(f.Type) {
		return "", false
	}
	name := strings.ToLower(f.Name)

	switch {
	case strings.Contains(name, "email"):
		return quoteLiteral(gofakeit.Email()), true
	case strings.Contains(name, "first_name") || name == "firstname":
		return quoteLiteral(gofakeit.FirstName()), true
	case strings.Contains(name, "last_name") || name == "lastname":
		return quoteLiteral(gofakeit.LastName()), true
	case name == "name" || strings.HasSuffix(name, "_name"):
		return quoteLiteral(gofakeit.Name()), true
	case strings.Contains(name, "username"):
		return quoteLiteral(gofakeit.Username()), true
	case strings.Contains(name, "phone"):
		return quoteLiteral(gofakeit.Phone()), true
	case strings.Contains(name, "company"):
		return quoteLiteral(gofakeit.Company()), true
	case strings.Contains(name, "address") && !strings.Contains(name, "email"):
		return quoteLiteral(gofakeit.Street()), true
	case strings.Contains(name, "city"):
		return quoteLiteral(gofakeit.City()), true
	case strings.Contains(name, "state"):
		return quoteLiteral(gofakeit.State()), true
	case strings.Contains(name, "country"):
		return quoteLiteral(gofakeit.Country()), true
	case strings.Contains(name, "zip") || strings.Contains(name, "postal"):
		return quoteLiteral(gofakeit.Zip()), true
	case strings.Contains(name, "url") || strings.Contains(name, "website"):
		return quoteLiteral(gofakeit.URL()), true
	case strings.Contains(name, "title"):
		return quoteLiteral(gofakeit.JobTitle()), true
	case strings.Contains(name, "description") || strings.Contains(name, "bio"):
		return quoteLiteral(gofakeit.Sentence(12)), true
	case strings.Contains(name, "slug"):
		return quoteLiteral(strings.ToLower(gofakeit.Word() + "-" + gofakeit.Word())), true
	case strings.Contains(name, "color"):
		return quoteLiteral(gofakeit.Color()), true
	case strings.Contains(name, "currency"):
		return quoteLiteral(gofakeit.CurrencyShort()), true
	case strings.Contains(name, "avatar") || strings.Contains(name, "image") || strings.Contains(name, "photo"):
		return quoteLiteral(gofakeit.URL()), true
	}
	return "", false
}

func isStringType(t FieldType) bool {
	switch t {
	case FieldTypeChar, FieldTypeVarchar, FieldTypeText:
		return true
	default:
		return false
	}
}
