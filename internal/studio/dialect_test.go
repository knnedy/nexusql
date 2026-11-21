package studio_test

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/knnedy/nexusql/internal/seed"
	"github.com/knnedy/nexusql/internal/studio"
)

// testDialect runs the studio behaviours that depend on the provider and its
// schema resolution against a fresh, empty database at uri.
func testDialect(t *testing.T, uri string) {
	s := newService(t)
	ctx := context.Background()
	if _, err := s.Connect(ctx, uri, "dialect"); err != nil {
		t.Fatal(err)
	}
	exec := func(sql string) {
		t.Helper()
		if _, err := s.Query(ctx, sql, true); err != nil {
			t.Fatalf("%s: %v", sql, err)
		}
	}
	// Created after connecting, so any schema cache must follow console DDL.
	exec(`CREATE TABLE items (id INTEGER PRIMARY KEY, label VARCHAR(50))`)
	exec(`INSERT INTO items (id, label) VALUES (1, 'beta'), (2, 'alpha')`)

	t.Run("schema without a name uses the dialect default", func(t *testing.T) {
		sch, err := s.Schema(ctx, "")
		if err != nil {
			t.Fatal(err)
		}
		if _, ok := sch.Table("items"); !ok {
			t.Fatalf("items missing from %+v", sch.Tables)
		}
	})

	t.Run("rows sort and search", func(t *testing.T) {
		page, err := s.Rows(ctx, studio.RowsQuery{Table: "items", Limit: 10, SortCol: "label"})
		if err != nil {
			t.Fatal(err)
		}
		if len(page.Rows) != 2 || str(page.Rows[0]["label"]) != "alpha" {
			t.Fatalf("sorted rows = %v, want alpha first", page.Rows)
		}
		page, err = s.Rows(ctx, studio.RowsQuery{Table: "items", Limit: 10, Search: "BET"})
		if err != nil || page.Total != 1 {
			t.Fatalf("search: total %d err %v, want 1", page.Total, err)
		}
	})

	t.Run("lookup and update", func(t *testing.T) {
		_, rows, err := s.LookupRows(ctx, "items", "label", "alpha")
		if err != nil || len(rows) != 1 {
			t.Fatalf("lookup: %v %v", rows, err)
		}
		err = s.UpdateRow(ctx, studio.RowUpdate{Table: "items", PKField: "id", PKValue: "1", TargetField: "label", NewValue: "gamma"})
		if err != nil {
			t.Fatal(err)
		}
		if _, rows, _ := s.LookupRows(ctx, "items", "label", "gamma"); len(rows) != 1 {
			t.Fatalf("updated row not found: %v", rows)
		}
	})

	t.Run("unknown identifiers are rejected before reaching the database", func(t *testing.T) {
		for name, err := range map[string]error{
			"rows table":    rowsErr(s.Rows(ctx, studio.RowsQuery{Table: "ghost", Limit: 1})),
			"sort column":   rowsErr(s.Rows(ctx, studio.RowsQuery{Table: "items", Limit: 1, SortCol: "ghost"})),
			"lookup table":  lookupErr(s.LookupRows(ctx, "ghost", "id", "1")),
			"lookup field":  lookupErr(s.LookupRows(ctx, "items", "ghost", "1")),
			"update table":  s.UpdateRow(ctx, studio.RowUpdate{Table: "ghost", PKField: "id", PKValue: "1", TargetField: "label"}),
			"update pk":     s.UpdateRow(ctx, studio.RowUpdate{Table: "items", PKField: "ghost", PKValue: "1", TargetField: "label"}),
			"update target": s.UpdateRow(ctx, studio.RowUpdate{Table: "items", PKField: "id", PKValue: "1", TargetField: "ghost"}),
		} {
			if !errors.Is(err, studio.ErrInvalid) {
				t.Errorf("%s: err = %v, want ErrInvalid", name, err)
			}
		}
	})

	t.Run("seed finds the tables", func(t *testing.T) {
		exec(`CREATE TABLE notes (body VARCHAR(50))`)
		res, err := s.Seed(ctx, seed.Options{RowsPerTable: 3})
		if err != nil {
			t.Fatal(err)
		}
		if res.RowsInserted["notes"] != 3 {
			t.Fatalf("inserted %v, want 3 notes", res.RowsInserted)
		}
	})

	t.Run("dropped tables are forgotten", func(t *testing.T) {
		exec(`DROP TABLE items`)
		if _, err := s.Rows(ctx, studio.RowsQuery{Table: "items", Limit: 1}); !errors.Is(err, studio.ErrInvalid) {
			t.Fatalf("rows of dropped table: err = %v, want ErrInvalid", err)
		}
	})
}

func rowsErr(_ studio.RowsPage, err error) error                { return err }
func lookupErr(_ []string, _ []map[string]any, err error) error { return err }

// str renders a scanned value dialect-neutrally ([]byte vs string).
func str(v any) string {
	if b, ok := v.([]byte); ok {
		return string(b)
	}
	return fmt.Sprint(v)
}
