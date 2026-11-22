package studio_test

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/knnedy/nexusql/internal/seed"
	"github.com/knnedy/nexusql/internal/studio"
)

// testDialect runs the studio behaviours that depend on the provider and its
// schema resolution against a fresh, empty database at uri; slowSQL must run
// for well over a second.
func testDialect(t *testing.T, uri, slowSQL string) {
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
		if err != nil || len(page.Rows) != 1 {
			t.Fatalf("search: total %d err %v, want 1", len(page.Rows), err)
		}
	})

	t.Run("lookup and update", func(t *testing.T) {
		_, rows, err := s.LookupRows(ctx, "items", "label", "alpha")
		if err != nil || len(rows) != 1 {
			t.Fatalf("lookup: %v %v", rows, err)
		}
		err = s.UpdateRow(ctx, studio.RowUpdate{Table: "items", Key: map[string]string{"id": "1"}, Column: "label", Value: ptr("gamma")})
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
			"update table":  s.UpdateRow(ctx, studio.RowUpdate{Table: "ghost", Key: map[string]string{"id": "1"}, Column: "label"}),
			"update key":    s.UpdateRow(ctx, studio.RowUpdate{Table: "items", Key: map[string]string{"ghost": "1"}, Column: "label"}),
			"update target": s.UpdateRow(ctx, studio.RowUpdate{Table: "items", Key: map[string]string{"id": "1"}, Column: "ghost"}),
		} {
			if !errors.Is(err, studio.ErrInvalid) {
				t.Errorf("%s: err = %v, want ErrInvalid", name, err)
			}
		}
	})

	t.Run("row edits", func(t *testing.T) {
		exec(`CREATE TABLE members (org_id INTEGER, user_id INTEGER, role VARCHAR(20), PRIMARY KEY (org_id, user_id))`)
		exec(`INSERT INTO members VALUES (1, 1, 'a'), (1, 2, 'b')`)
		exec(`CREATE TABLE loose (label VARCHAR(20))`)
		exec(`INSERT INTO loose VALUES ('x')`)
		t.Cleanup(func() { exec(`DROP TABLE members`); exec(`DROP TABLE loose`) })
		role := func(user string) any {
			t.Helper()
			_, rows, err := s.LookupRows(ctx, "members", "user_id", user)
			if err != nil || len(rows) != 1 {
				t.Fatalf("lookup user %s: %v %v", user, rows, err)
			}
			return rows[0]["role"]
		}
		edit := func(key map[string]string, value *string) error {
			return s.UpdateRow(ctx, studio.RowUpdate{Table: "members", Key: key, Column: "role", Value: value})
		}
		full := map[string]string{"org_id": "1", "user_id": "2"}

		if err := edit(full, ptr("z")); err != nil {
			t.Fatal(err)
		}
		if str(role("2")) != "z" || str(role("1")) != "a" {
			t.Fatalf("composite key edit: roles %v/%v, want a/z", role("1"), role("2"))
		}
		if err := edit(full, ptr("z")); err != nil {
			t.Errorf("unchanged value: %v", err)
		}
		if err := edit(full, nil); err != nil || role("2") != nil {
			t.Errorf("nil value: role %v err %v, want NULL", role("2"), err)
		}
		if err := edit(full, ptr("")); err != nil || role("2") == nil || str(role("2")) != "" {
			t.Errorf("empty value: role %#v err %v, want empty string", role("2"), err)
		}
		for name, key := range map[string]map[string]string{
			"partial key":    {"org_id": "1"},
			"non-key column": {"org_id": "1", "user_id": "2", "role": "z"},
			"no key":         {},
		} {
			if err := edit(key, ptr("q")); !errors.Is(err, studio.ErrInvalid) {
				t.Errorf("%s: err = %v, want ErrInvalid", name, err)
			}
		}
		if str(role("1")) != "a" {
			t.Fatalf("rejected edits changed user 1: role %v", role("1"))
		}
		if err := edit(map[string]string{"org_id": "9", "user_id": "9"}, ptr("q")); !errors.Is(err, studio.ErrNotFound) {
			t.Errorf("missing row: err = %v, want ErrNotFound", err)
		}
		err := s.UpdateRow(ctx, studio.RowUpdate{Table: "loose", Key: map[string]string{"label": "x"}, Column: "label", Value: ptr("y")})
		if !errors.Is(err, studio.ErrInvalid) {
			t.Errorf("table without primary key: err = %v, want ErrInvalid", err)
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

	t.Run("console limits", func(t *testing.T) {
		limited := newServiceWith(t, studio.Config{QueryTimeout: 300 * time.Millisecond, MaxRows: 1})
		if _, err := limited.Connect(ctx, uri, "limited"); err != nil {
			t.Fatal(err)
		}
		res, err := limited.Query(ctx, "SELECT label FROM items", false)
		if err != nil || len(res.Rows) != 1 || !res.Truncated {
			t.Errorf("capped query: rows=%d truncated=%v err=%v, want 1 row, truncated", len(res.Rows), res.Truncated, err)
		}

		start := time.Now()
		_, err = limited.Query(ctx, slowSQL, false)
		if !errors.Is(err, studio.ErrTimeout) || time.Since(start) > 5*time.Second {
			t.Errorf("slow query: err=%v after %s, want ErrTimeout soon after 300ms", err, time.Since(start))
		}
		if _, err := limited.Query(ctx, "SELECT 1", false); err != nil {
			t.Errorf("connection unusable after a timeout: %v", err)
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

func ptr(s string) *string { return &s }
