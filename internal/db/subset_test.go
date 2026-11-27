package db

import (
	"errors"
	"reflect"
	"testing"
)

func TestSchemaSubset(t *testing.T) {
	fk := func(name string) Field { return Field{Name: name, Type: "integer", IsForeignKey: true} }
	rel := func(src, col, dst string) Relation {
		return Relation{ConstraintName: src + "_" + col, SourceTable: src, SourceField: col, TargetTable: dst, TargetField: "id",
			SourceFields: []string{col}, TargetFields: []string{"id"}}
	}
	s := &Schema{
		Tables: []Table{
			{Name: "users", Fields: []Field{{Name: "id", IsPrimaryKey: true}, {Name: "mood", Type: "mood"}}},
			{Name: "orgs", Fields: []Field{{Name: "id", IsPrimaryKey: true}}},
			{Name: "posts", Fields: []Field{{Name: "id", IsPrimaryKey: true}, fk("user_id"), fk("org_id"), {Name: "kind", Type: "kind"}}},
		},
		Relations: []Relation{rel("posts", "user_id", "users"), rel("posts", "org_id", "orgs"), rel("users", "id", "users")},
		Enums:     []EnumType{{Name: "mood"}, {Name: "kind"}, {Name: "unused"}},
	}

	got, err := s.Subset([]string{"posts", "users"})
	if err != nil {
		t.Fatal(err)
	}
	var names []string
	for _, tb := range got.Tables {
		names = append(names, tb.Name)
	}
	if !reflect.DeepEqual(names, []string{"users", "posts"}) {
		t.Errorf("tables %v, want users, posts in schema order", names)
	}
	var rels []string
	for _, r := range got.Relations {
		rels = append(rels, r.ConstraintName)
	}
	if !reflect.DeepEqual(rels, []string{"posts_user_id", "users_id"}) {
		t.Errorf("relations %v, want only those between kept tables", rels)
	}
	posts := got.Tables[1].Fields
	if !posts[1].IsForeignKey || posts[2].IsForeignKey {
		t.Errorf("user_id fk=%v org_id fk=%v: a key to a table left out becomes a plain column", posts[1].IsForeignKey, posts[2].IsForeignKey)
	}
	var enums []string
	for _, e := range got.Enums {
		enums = append(enums, e.Name)
	}
	if !reflect.DeepEqual(enums, []string{"mood", "kind"}) {
		t.Errorf("enums %v, want only those the kept columns use", enums)
	}
	if !s.Tables[2].Fields[2].IsForeignKey {
		t.Error("the original schema must not change")
	}

	if _, err := s.Subset([]string{"posts", "nope"}); !errors.Is(err, ErrUnknownTable) {
		t.Errorf("unknown table: err %v, want ErrUnknownTable", err)
	}
	if all, _ := s.Subset(nil); all != s {
		t.Error("no names means the whole schema")
	}
}
