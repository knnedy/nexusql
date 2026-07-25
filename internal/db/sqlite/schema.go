package sqlite

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/knnedy/nexusql/internal/db"
)

const queryTableNames = `
SELECT name FROM sqlite_master
WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
ORDER BY name
`

// schema is accepted for interface parity with other providers but is a
// no-op here — SQLite databases are single files with no meaningful
// equivalent to Postgres schemas for our purposes.
func (p *provider) IntrospectSchema(ctx context.Context, schema string) (*db.Schema, error) {
	tableNames, err := p.introspectTableNames(ctx)
	if err != nil {
		return nil, fmt.Errorf("introspect table names: %w", err)
	}

	tables := make([]db.Table, 0, len(tableNames))
	var relations []db.Relation

	for _, name := range tableNames {
		fields, err := p.introspectColumns(ctx, name)
		if err != nil {
			return nil, fmt.Errorf("introspect columns for %s: %w", name, err)
		}
		tables = append(tables, db.Table{
			Name:   name,
			Schema: "",
			Fields: fields,
		})

		rels, err := p.introspectForeignKeys(ctx, name, tableNames)
		if err != nil {
			return nil, fmt.Errorf("introspect foreign keys for %s: %w", name, err)
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

func (p *provider) introspectColumns(ctx context.Context, tableName string) ([]db.Field, error) {
	query := fmt.Sprintf("PRAGMA table_info(%s)", quoteIdent(tableName))

	rows, err := p.conn.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

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
			// on insert when omitted — treat this as an implicit default so
			// the seeder omits the column and reads the value back via
			// RETURNING, instead of generating its own PK value.
			implicit := "AUTOINCREMENT"
			defaultValue = &implicit
		}

		fields = append(fields, db.Field{
			Name:         name,
			Type:         normalizeType(declType),
			Nullable:     notNull == 0,
			IsPrimaryKey: pk > 0,
			IsForeignKey: false,
			DefaultValue: defaultValue,
		})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	fkCols, err := p.foreignKeyColumns(ctx, tableName)
	if err != nil {
		return nil, err
	}
	for i := range fields {
		if fkCols[fields[i].Name] {
			fields[i].IsForeignKey = true
		}
	}

	return fields, nil
}

func (p *provider) foreignKeyColumns(ctx context.Context, tableName string) (map[string]bool, error) {
	query := fmt.Sprintf("PRAGMA foreign_key_list(%s)", quoteIdent(tableName))
	rows, err := p.conn.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	cols := map[string]bool{}
	for rows.Next() {
		var (
			id, seq                       int
			table, from                   string
			to, onUpdate, onDelete, match sql.NullString
		)
		if err := rows.Scan(&id, &seq, &table, &from, &to, &onUpdate, &onDelete, &match); err != nil {
			return nil, fmt.Errorf("scan foreign key: %w", err)
		}
		cols[from] = true
	}
	return cols, rows.Err()
}

func (p *provider) introspectForeignKeys(ctx context.Context, tableName string, allTables []string) ([]db.Relation, error) {
	query := fmt.Sprintf("PRAGMA foreign_key_list(%s)", quoteIdent(tableName))
	rows, err := p.conn.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var relations []db.Relation
	for rows.Next() {
		var (
			id, seq                                int
			targetTable, sourceField               string
			targetField, onUpdate, onDelete, match sql.NullString
		)
		if err := rows.Scan(&id, &seq, &targetTable, &sourceField, &targetField, &onUpdate, &onDelete, &match); err != nil {
			return nil, fmt.Errorf("scan foreign key: %w", err)
		}

		resolvedTarget := targetField.String
		if resolvedTarget == "" {
			// "to" is blank when the FK implicitly references the target
			// table's primary key rather than naming a column explicitly.
			pkCol, err := p.primaryKeyColumn(ctx, targetTable)
			if err != nil {
				return nil, fmt.Errorf("resolve implicit FK target for %s: %w", targetTable, err)
			}
			resolvedTarget = pkCol
		}

		relations = append(relations, db.Relation{
			ConstraintName: fmt.Sprintf("fk_%s_%d", tableName, id),
			SourceTable:    tableName,
			SourceField:    sourceField,
			TargetTable:    targetTable,
			TargetField:    resolvedTarget,
		})
	}
	return relations, rows.Err()
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
	return "", fmt.Errorf("no single-column primary key found for %s", tableName)
}

func quoteIdent(name string) string {
	return `"` + strings.ReplaceAll(name, `"`, `""`) + `"`
}

// normalizeType maps a SQLite declared column type onto the canonical
// FieldType enum. SQLite uses type affinity, not strict typing — the
// declared type is a hint, not an enforced constraint — so this checks
// specific substrings for finer-grained mapping before falling back to
// SQLite's own affinity rules (INTEGER/TEXT/BLOB/REAL/NUMERIC).
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
		// SQLite's NUMERIC affinity catch-all — closest canonical match.
		return db.FieldTypeNumeric
	}
}
