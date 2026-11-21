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
	RowsInserted map[string]int // tableName -> rows inserted
}

// pkInsertMode describes how a generated INSERT statement's primary key
// value needs to be recovered after execution, since the three providers
// differ in what they can hand back:
//   - pkNone: table has no PK field (or this row omits it), plain Exec.
//   - pkNeedsReturning: PK has a DB-side default (serial, AUTO_INCREMENT,
//     gen_random_uuid()) — the value only exists after the DB assigns it,
//     so it must be read back via InsertReturningPK.
//   - pkSelfGenerated: PK was generated client-side and is already
//     embedded in the INSERT's VALUES clause — the value is already known,
//     so a round-trip through InsertReturningPK would be redundant (and,
//     for MySQL, impossible for non-integer PKs, since MySQL has no
//     RETURNING clause and LAST_INSERT_ID() only reports AUTO_INCREMENT
//     values).
type pkInsertMode int

const (
	pkNone pkInsertMode = iota
	pkNeedsReturning
	pkSelfGenerated
)

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

// Run generates and inserts fake rows for every table in schema, in FK
// dependency order, inside a single transaction. PK values that the DB
// assigns (serial/AUTO_INCREMENT/etc.) are captured via InsertReturningPK
// as each row is inserted; PK values generated client-side are already
// known and reused directly, without a redundant round-trip. Either way,
// child tables always reference real parent PKs.
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
	result := &Result{RowsInserted: map[string]int{}}

	for _, tableName := range order {
		table := tablesByName[tableName]

		var insertedThisTable []string
		for i := 0; i < opts.RowsPerTable; i++ {
			sqlStmt, pkMode, selfPK := buildInsertSQL(provider, table, fkByField, generatedPKs, enumsByName, opts.NullChance)

			switch pkMode {
			case pkNeedsReturning:
				pkField := findPKField(table)
				pkVal, err := tx.InsertReturningPK(ctx, sqlStmt, pkField.Name)
				if err != nil {
					return nil, fmt.Errorf("table %s row %d: %w", tableName, i, err)
				}
				insertedThisTable = append(insertedThisTable, pkVal)
			case pkSelfGenerated:
				if err := tx.Exec(ctx, sqlStmt); err != nil {
					return nil, fmt.Errorf("table %s row %d: %w", tableName, i, err)
				}
				insertedThisTable = append(insertedThisTable, selfPK)
			default:
				if err := tx.Exec(ctx, sqlStmt); err != nil {
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

func findPKField(table db.Table) *db.Field {
	for i := range table.Fields {
		if table.Fields[i].IsPrimaryKey {
			return &table.Fields[i]
		}
	}
	return nil
}

// buildInsertSQL builds an INSERT statement for one row of table, using
// provider for all dialect-specific quoting. The PK column is either
// omitted (DB assigns it — pkNeedsReturning) or included with a
// client-generated value (pkSelfGenerated); pkNone means the table has no
// PK field at all. selfGeneratedPK is only meaningful when pkMode is
// pkSelfGenerated, and is the raw (unquoted) value already embedded in the
// statement — the same shape InsertReturningPK's implementations return,
// so callers can treat both sources identically afterward.
func buildInsertSQL(provider db.Provider, table db.Table, fkByField map[string]db.Relation, generatedPKs map[string][]string, enums map[string]db.EnumType, nullChance float64) (sql string, pkMode pkInsertMode, selfGeneratedPK string) {
	var cols, vals []string

	for _, f := range table.Fields {
		if f.IsPrimaryKey {
			if f.DefaultValue != nil {
				// DB has a default (serial sequence, gen_random_uuid(),
				// AUTO_INCREMENT, etc.) — omit the column and let the DB
				// assign it; read it back via InsertReturningPK.
				pkMode = pkNeedsReturning
				continue
			}
			// No DB-level default — generate a value ourselves. It's
			// already known at this point, so there's nothing to read
			// back afterward.
			pkMode = pkSelfGenerated
			raw := generatePKValue(f)
			selfGeneratedPK = raw

			cols = append(cols, provider.QuoteIdentifier(f.Name))
			if needsQuoting(f.Type) {
				vals = append(vals, quoteLiteral(raw))
			} else {
				vals = append(vals, raw)
			}
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

		cols = append(cols, provider.QuoteIdentifier(f.Name))
		vals = append(vals, v)
	}

	if len(cols) == 0 {
		return provider.EmptyInsertSQL(table), pkMode, selfGeneratedPK
	}

	return fmt.Sprintf(
		"INSERT INTO %s (%s) VALUES (%s)",
		provider.QuoteTable(table),
		strings.Join(cols, ", "),
		strings.Join(vals, ", "),
	), pkMode, selfGeneratedPK
}

// generatePKValue returns a raw (unquoted) client-generated primary key
// value. Callers quote it themselves via needsQuoting/quoteLiteral when
// embedding it in SQL — kept raw here so the same value can also be stored
// directly in generatedPKs without stripping quotes back off.
func generatePKValue(f db.Field) string {
	switch f.Type {
	case db.FieldTypeUUID:
		return gofakeit.UUID()
	case db.FieldTypeText, db.FieldTypeVarchar, db.FieldTypeChar:
		return gofakeit.UUID()
	default:
		// integer-ish PK with no sequence/default behind it
		return fmt.Sprintf("%d", gofakeit.Number(100000, 9999999))
	}
}

func needsQuoting(t db.FieldType) bool {
	switch t {
	case db.FieldTypeUUID, db.FieldTypeText, db.FieldTypeVarchar, db.FieldTypeChar:
		return true
	default:
		return false
	}
}

func valueOrNull(f db.Field, enums map[string]db.EnumType, nullChance float64) string {
	if f.Nullable && mrand.Float64() < nullChance {
		return "NULL"
	}
	return GenerateFakeValue(f, enums)
}

func quoteLiteral(s string) string {
	return "'" + strings.ReplaceAll(s, "'", "''") + "'"
}

// GenerateFakeValue is unchanged from the GoFakeIt version — enum match,
// then column-name sniffing, then type-based fallback.
func GenerateFakeValue(f db.Field, enums map[string]db.EnumType) string {
	if enum, ok := enums[string(f.Type)]; ok && len(enum.Values) > 0 {
		return quoteLiteral(gofakeit.RandomString(enum.Values))
	}
	if v, ok := generateByColumnName(f); ok {
		return v
	}
	switch f.Type {
	case db.FieldTypeSerial, db.FieldTypeBigserial, db.FieldTypeInteger, db.FieldTypeBigint, db.FieldTypeSmallint:
		return fmt.Sprintf("%d", gofakeit.Number(1, 10000))
	case db.FieldTypeNumeric, db.FieldTypeReal, db.FieldTypeDoublePrecision:
		return fmt.Sprintf("%.2f", gofakeit.Float64Range(0, 10000))
	case db.FieldTypeBoolean:
		return fmt.Sprintf("%v", gofakeit.Bool())
	case db.FieldTypeUUID:
		return quoteLiteral(gofakeit.UUID())
	case db.FieldTypeDate:
		return quoteLiteral(gofakeit.Date().Format("2006-01-02"))
	case db.FieldTypeTime:
		return quoteLiteral(gofakeit.Date().Format("15:04:05"))
	case db.FieldTypeTimestamp:
		return quoteLiteral(gofakeit.Date().Format("2006-01-02 15:04:05"))
	case db.FieldTypeTimestamptz:
		return quoteLiteral(gofakeit.Date().Format("2006-01-02 15:04:05-07"))
	case db.FieldTypeInterval:
		return quoteLiteral(fmt.Sprintf("%d days", gofakeit.Number(1, 30)))
	case db.FieldTypeJSON, db.FieldTypeJSONB:
		return quoteLiteral(fmt.Sprintf(`{"seed": %d}`, gofakeit.Number(1, 1000)))
	case db.FieldTypeBytea:
		return quoteLiteral(fmt.Sprintf(`\x%x`, gofakeit.LetterN(16)))
	case db.FieldTypeChar:
		return quoteLiteral(gofakeit.Letter())
	case db.FieldTypeText:
		return quoteLiteral(gofakeit.Sentence(8))
	default: // varchar and anything else string-shaped
		return quoteLiteral(gofakeit.Word())
	}
}

func generateByColumnName(f db.Field) (string, bool) {
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

func isStringType(t db.FieldType) bool {
	switch t {
	case db.FieldTypeChar, db.FieldTypeVarchar, db.FieldTypeText:
		return true
	default:
		return false
	}
}
