package export_test

import (
	"strings"
	"testing"

	"github.com/knnedy/nexusql/internal/db"
	"github.com/knnedy/nexusql/internal/export"

	_ "github.com/knnedy/nexusql/internal/db/sqlite"
)

// SQL allows SET NULL on a NOT NULL column (it fails when it fires); Prisma
// rejects SetNull on a required relation, so the action is left out.
func TestPrismaLeavesOutSetNullOnARequiredRelation(t *testing.T) {
	ex, err := db.ExporterFor(db.ProviderKindSQLite)
	if err != nil {
		t.Fatal(err)
	}
	id := func(name string) db.Field {
		return db.Field{Name: name, Type: db.FieldTypeInteger, NativeType: "INTEGER", IsPrimaryKey: name == "id"}
	}
	schema := &db.Schema{
		Tables: []db.Table{
			{Name: "parent", Fields: []db.Field{id("id")}},
			{Name: "child", Fields: []db.Field{id("id"), id("parent_id")}},
		},
		Relations: []db.Relation{{
			SourceTable: "child", SourceField: "parent_id", TargetTable: "parent", TargetField: "id",
			OnDelete: db.SetNull, OnUpdate: db.Cascade,
		}},
	}
	out := export.Prisma(export.Build(schema, ex))
	if !strings.Contains(out, "@relation(fields: [parent_id], references: [id])") {
		t.Fatalf("want a relation with no actions:\n%s", out)
	}
}
