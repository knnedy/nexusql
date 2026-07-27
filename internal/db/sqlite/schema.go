package sqlite

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"sort"
	"strings"

	"github.com/knnedy/nexusql/internal/db"
)

const queryTableNames = `
SELECT name FROM sqlite_master
WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
ORDER BY name
`

func (p *provider) IntrospectSchema(ctx context.Context, schema string) (*db.Schema, error) {
	tableNames, err := p.introspectTableNames(ctx)
	if err != nil {
		return nil, fmt.Errorf("introspect table names: %w", err)
	}

	tables := make([]db.Table, 0, len(tableNames))
	var relations []db.Relation

	for _, name := range tableNames {
		fkRows, err := p.foreignKeyRows(ctx, name)
		if err != nil {
			return nil, fmt.Errorf("introspect foreign keys for %s: %w", name, err)
		}

		fields, err := p.introspectColumns(ctx, name, fkRows)
		if err != nil {
			return nil, fmt.Errorf("introspect columns for %s: %w", name, err)
		}
		tables = append(tables, db.Table{Name: name, Schema: "", Fields: fields})

		rels, err := buildRelations(ctx, p, name, fkRows)
		if err != nil {
			return nil, fmt.Errorf("build relations for %s: %w", name, err)
		}
		relations = append(relations, rels...)
	}

	return &db.Schema{
		Tables:    tables,
		Relations: relations,
		Enums:     []db.EnumType{}, // SQLite has no native enum type
	}, nil
}

func (p *provider) introspectTableNames(ctx context.Context) ([]string, error) {
	rows, err := p.conn.QueryContext(ctx, queryTableNames)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var names []string
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, fmt.Errorf("scan table name: %w", err)
		}
		names = append(names, name)
	}
	return names, rows.Err()
}

// fkRow mirrors one row of PRAGMA foreign_key_list output. Multiple rows
// share the same id when a foreign key spans multiple columns; seq gives
// each row's position within that composite key.
type fkRow struct {
	id, seq     int
	targetTable string
	sourceField string
	targetField string
}

// foreignKeyRows runs PRAGMA foreign_key_list once per table; the result is
// reused for both column-level IsForeignKey flags and relation building, so
// the pragma is never queried twice for the same table.
func (p *provider) foreignKeyRows(ctx context.Context, tableName string) ([]fkRow, error) {
	query := fmt.Sprintf("PRAGMA foreign_key_list(%s)", quoteIdent(tableName))
	rows, err := p.conn.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []fkRow
	for rows.Next() {
		var (
			id, seq                       int
			table, from                   string
			to, onUpdate, onDelete, match sql.NullString
		)
		if err := rows.Scan(&id, &seq, &table, &from, &to, &onUpdate, &onDelete, &match); err != nil {
			return nil, fmt.Errorf("scan foreign key: %w", err)
		}
		out = append(out, fkRow{
			id:          id,
			seq:         seq,
			targetTable: table,
			sourceField: from,
			targetField: to.String,
		})
	}
	return out, rows.Err()
}

func (p *provider) introspectColumns(ctx context.Context, tableName string, fkRows []fkRow) ([]db.Field, error) {
	query := fmt.Sprintf("PRAGMA table_info(%s)", quoteIdent(tableName))

	rows, err := p.conn.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	fkCols := map[string]bool{}
	for _, fk := range fkRows {
		fkCols[fk.sourceField] = true
	}

	var fields []db.Field
	for rows.Next() {
		var (
			cid       int
			name      string
			declType  string
			notNull   int
			dfltValue sql.NullString
			pk        int
		)

		if err := rows.Scan(&cid, &name, &declType, &notNull, &dfltValue, &pk); err != nil {
			return nil, fmt.Errorf("scan column: %w", err)
		}

		var defaultValue *string
		switch {
		case dfltValue.Valid:
			v := dfltValue.String
			defaultValue = &v
		case pk > 0 && strings.Contains(strings.ToUpper(declType), "INT"):
			// SQLite auto-assigns rowid-aliased INTEGER PRIMARY KEY columns
			// on insert when omitted — treat as an implicit default so the
			// seeder omits the column and reads the value back via RETURNING.
			implicit := "AUTOINCREMENT"
			defaultValue = &implicit
		}

		fields = append(fields, db.Field{
			Name:         name,
			Type:         normalizeType(declType),
			Nullable:     notNull == 0,
			IsPrimaryKey: pk > 0,
			IsForeignKey: fkCols[name],
			DefaultValue: defaultValue,
		})
	}

	return fields, rows.Err()
}

// buildRelations groups fkRows by id to detect composite (multi-column)
// foreign keys. db.Relation can only express a single column pair, so
// composite keys are logged and skipped rather than silently collapsed
// into an incorrect single-column relation.
func buildRelations(ctx context.Context, p *provider, tableName string, fkRows []fkRow) ([]db.Relation, error) {
	byID := map[int][]fkRow{}
	var order []int
	for _, r := range fkRows {
		if _, exists := byID[r.id]; !exists {
			order = append(order, r.id)
		}
		byID[r.id] = append(byID[r.id], r)
	}
	sort.Ints(order)

	var relations []db.Relation
	for _, id := range order {
		group := byID[id]
		if len(group) > 1 {
			log.Printf(
				"sqlite: skipping composite foreign key on %s (id=%d, %d columns) — not representable by db.Relation",
				tableName, id, len(group),
			)
			continue
		}

		row := group[0]
		targetField := row.targetField
		if targetField == "" {
			pkCol, err := p.primaryKeyColumn(ctx, row.targetTable)
			if err != nil {
				return nil, fmt.Errorf("resolve implicit FK target for %s: %w", row.targetTable, err)
			}
			targetField = pkCol
		}

		relations = append(relations, db.Relation{
			ConstraintName: fmt.Sprintf("fk_%s_%d", tableName, id),
			SourceTable:    tableName,
			SourceField:    row.sourceField,
			TargetTable:    row.targetTable,
			TargetField:    targetField,
		})
	}
	return relations, nil
}

func (p *provider) primaryKeyColumn(ctx context.Context, tableName string) (string, error) {
	query := fmt.Sprintf("PRAGMA table_info(%s)", quoteIdent(tableName))
	rows, err := p.conn.QueryContext(ctx, query)
	if err != nil {
		return "", err
	}
	defer rows.Close()

	for rows.Next() {
		var (
			cid       int
			name      string
			declType  string
			notNull   int
			dfltValue sql.NullString
			pk        int
		)
		if err := rows.Scan(&cid, &name, &declType, &notNull, &dfltValue, &pk); err != nil {
			return "", err
		}
		if pk == 1 {
			return name, nil
		}
	}
	if err := rows.Err(); err != nil {
		return "", err
	}
	return "", fmt.Errorf("no single-column primary key found for %s", tableName)
}

func quoteIdent(name string) string {
	return `"` + strings.ReplaceAll(name, `"`, `""`) + `"`
}
