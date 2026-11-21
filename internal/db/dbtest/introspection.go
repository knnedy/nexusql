package dbtest

import (
	"context"
	"testing"

	"github.com/knnedy/nexusql/internal/db"
)

func testIntrospection(t *testing.T, h Harness) {
	p := setup(t, h)
	schema, err := p.IntrospectSchema(context.Background(), p.DefaultSchema())
	if err != nil {
		t.Fatalf("IntrospectSchema: %v", err)
	}

	t.Run("lists fixture tables", func(t *testing.T) {
		for _, name := range []string{"users", "posts"} {
			if findTable(schema, name) == nil {
				t.Errorf("table %q missing", name)
			}
		}
	})

	t.Run("marks primary and foreign keys", func(t *testing.T) {
		if f := findField(t, schema, "users", "id"); !f.IsPrimaryKey {
			t.Error("users.id not marked primary key")
		}
		if f := findField(t, schema, "posts", "user_id"); !f.IsForeignKey {
			t.Error("posts.user_id not marked foreign key")
		}
		if f := findField(t, schema, "posts", "title"); f.IsPrimaryKey || f.IsForeignKey {
			t.Error("posts.title wrongly marked as a key")
		}
	})

	t.Run("reports nullability", func(t *testing.T) {
		if findField(t, schema, "users", "email").Nullable {
			t.Error("users.email is NOT NULL but reported nullable")
		}
		if !findField(t, schema, "users", "name").Nullable {
			t.Error("users.name is nullable but reported NOT NULL")
		}
	})

	t.Run("reports foreign key relation", func(t *testing.T) {
		for _, r := range schema.Relations {
			if r.SourceTable == "posts" && r.SourceField == "user_id" &&
				r.TargetTable == "users" && r.TargetField == "id" {
				return
			}
		}
		t.Errorf("relation posts.user_id -> users.id missing; got %+v", schema.Relations)
	})
}

func findTable(s *db.Schema, name string) *db.Table {
	for i := range s.Tables {
		if s.Tables[i].Name == name {
			return &s.Tables[i]
		}
	}
	return nil
}

func findField(t *testing.T, s *db.Schema, table, field string) db.Field {
	t.Helper()
	tbl := findTable(s, table)
	if tbl == nil {
		t.Fatalf("table %q missing", table)
	}
	for _, f := range tbl.Fields {
		if f.Name == field {
			return f
		}
	}
	t.Fatalf("field %s.%s missing", table, field)
	return db.Field{}
}
