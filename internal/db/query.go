package db

import (
	"context"
	"fmt"
	"regexp"
	"strings"
)

var destructiveKeywords = map[string]bool{
	"INSERT":   true,
	"UPDATE":   true,
	"DELETE":   true,
	"DROP":     true,
	"TRUNCATE": true,
	"ALTER":    true,
}

var leadingCommentRe = regexp.MustCompile(`^(\s*--[^\n]*\n|\s*/\*.*?\*/)*`)

func firstKeyword(sql string) string {
	stripped := leadingCommentRe.ReplaceAllString(strings.TrimSpace(sql), "")
	stripped = strings.TrimSpace(stripped)

	fields := strings.Fields(stripped)
	if len(fields) == 0 {
		return ""
	}
	return strings.ToUpper(fields[0])
}

// IsDestructiveQuery reports whether the given SQL statement begins with
// a keyword that mutates or drops data/schema. Used by the API layer to
// require explicit confirmation before executing a query from the SQL console.
func IsDestructiveQuery(sql string) bool {
	return destructiveKeywords[firstKeyword(sql)]
}

func isSelectQuery(sql string) bool {
	kw := firstKeyword(sql)
	return kw == "SELECT" || kw == "WITH" || kw == "EXPLAIN"
}

var hasLimitRe = regexp.MustCompile(`(?i)\blimit\s+\d+`)

func (p *postgresProvider) ExecuteQuery(ctx context.Context, sql string) ([]string, []map[string]any, int64, bool, error) {
	trimmed := strings.TrimSpace(sql)
	trimmed = strings.TrimSuffix(trimmed, ";")

	if isSelectQuery(trimmed) {
		if !hasLimitRe.MatchString(trimmed) {
			trimmed = trimmed + " LIMIT 500"
		}

		rows, err := p.pool.Query(ctx, trimmed)
		if err != nil {
			return nil, nil, 0, false, fmt.Errorf("query failed: %w", err)
		}
		defer rows.Close()

		fields := rows.FieldDescriptions()
		columns := make([]string, len(fields))
		for i, f := range fields {
			columns[i] = string(f.Name)
		}

		result := make([]map[string]any, 0)
		for rows.Next() {
			values, err := rows.Values()
			if err != nil {
				return nil, nil, 0, false, fmt.Errorf("scan row: %w", err)
			}
			row := make(map[string]any, len(columns))
			for i, col := range columns {
				row[col] = normalizeValue(values[i])
			}
			result = append(result, row)
		}

		if err := rows.Err(); err != nil {
			return nil, nil, 0, false, err
		}

		return columns, result, 0, false, nil
	}

	tag, err := p.pool.Exec(ctx, trimmed)
	if err != nil {
		return nil, nil, 0, true, fmt.Errorf("execute failed: %w", err)
	}

	return nil, nil, tag.RowsAffected(), true, nil
}
