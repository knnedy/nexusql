package api_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"github.com/knnedy/nexusql/internal/api"
	_ "github.com/knnedy/nexusql/internal/db/sqlite"
	"github.com/knnedy/nexusql/internal/projects"
	"github.com/knnedy/nexusql/internal/session"
	"github.com/knnedy/nexusql/internal/studio"
)

func newAPI(t *testing.T) http.Handler {
	t.Helper()
	t.Setenv("HOME", t.TempDir())
	proj, err := projects.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	sess := session.NewStore()
	t.Cleanup(sess.Clear)
	return api.Router(studio.New(sess, proj, studio.Config{}), api.Config{})
}

func call(h http.Handler, method, path, body string) *httptest.ResponseRecorder {
	r := httptest.NewRequest(method, path, strings.NewReader(body))
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	return w
}

func TestProjectListNeverContainsThePassword(t *testing.T) {
	h := newAPI(t)
	if w := call(h, "POST", "/projects", `{"name":"shop","uri":"postgres://app:s3cret-pw@db.local/shop"}`); w.Code != http.StatusCreated {
		t.Fatalf("create: %d %s", w.Code, w.Body)
	}
	w := call(h, "GET", "/projects", "")
	if strings.Contains(w.Body.String(), "s3cret-pw") {
		t.Fatalf("GET /projects leaks the password: %s", w.Body)
	}
	if !strings.Contains(w.Body.String(), `"displayUri":"postgres://app:****@db.local/shop"`) {
		t.Fatalf("missing redacted displayUri: %s", w.Body)
	}
}

func TestConnectByProjectID(t *testing.T) {
	h := newAPI(t)
	uri := "sqlite://" + filepath.Join(t.TempDir(), "a.db")
	w := call(h, "POST", "/projects", `{"name":"local","uri":"`+uri+`"}`)
	var created struct {
		Project struct{ ID string } `json:"project"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &created); err != nil || created.Project.ID == "" {
		t.Fatalf("create: %d %s", w.Code, w.Body)
	}

	w = call(h, "POST", "/connect", `{"projectId":"`+created.Project.ID+`"}`)
	if w.Code != http.StatusOK || !strings.Contains(w.Body.String(), `"projectId":"`+created.Project.ID+`"`) {
		t.Fatalf("connect by id: %d %s", w.Code, w.Body)
	}
	if w := call(h, "POST", "/connect", `{"projectId":"missing"}`); w.Code != http.StatusNotFound {
		t.Fatalf("unknown id: %d, want 404", w.Code)
	}
}

func TestOversizedBodyIsRejected(t *testing.T) {
	h := newAPI(t)
	big := `{"sql":"SELECT '` + strings.Repeat("x", 2<<20) + `'"}`
	if w := call(h, "POST", "/query", big); w.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("status %d, want 413", w.Code)
	}
}

func TestUpdateRowBody(t *testing.T) {
	h := newAPI(t)
	uri := "sqlite://" + filepath.Join(t.TempDir(), "a.db")
	if w := call(h, "POST", "/connect", `{"uri":"`+uri+`","name":"x"}`); w.Code != http.StatusOK {
		t.Fatalf("connect: %d %s", w.Code, w.Body)
	}
	for _, q := range []string{
		`{"sql":"CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)","confirmed":true}`,
		`{"sql":"INSERT INTO t VALUES (1, 'a')","confirmed":true}`,
	} {
		if w := call(h, "POST", "/query", q); w.Code != http.StatusOK {
			t.Fatalf("query: %d %s", w.Code, w.Body)
		}
	}

	// In order: the null update must be the last successful one.
	for _, c := range []struct {
		body string
		want int
	}{
		{`{"key":{"id":"1"},"column":"v","value":"b"}`, http.StatusOK},
		{`{"key":{"id":"1"},"column":"v","value":null}`, http.StatusOK},
		{`{"key":{"id":"1"},"column":"v"}`, http.StatusBadRequest}, // value omitted
		{`{"key":{"id":"1"},"column":"v","value":5}`, http.StatusBadRequest},
		{`{"key":{"id":"9"},"column":"v","value":"b"}`, http.StatusNotFound},
	} {
		if w := call(h, "PATCH", "/rows/t", c.body); w.Code != c.want {
			t.Errorf("%s: %d %s, want %d", c.body, w.Code, w.Body, c.want)
		}
	}
	w := call(h, "GET", "/rows/t/lookup?field=id&value=1", "")
	if !strings.Contains(w.Body.String(), `"v":null`) {
		t.Fatalf("value after null update: %s", w.Body)
	}
}

func TestQueryResultsAlwaysCarryArrays(t *testing.T) {
	h := newAPI(t)
	uri := "sqlite://" + filepath.Join(t.TempDir(), "q.db")
	if w := call(h, "POST", "/connect", `{"uri":"`+uri+`","name":"q"}`); w.Code != http.StatusOK {
		t.Fatalf("connect: %d %s", w.Code, w.Body)
	}
	for _, sql := range []string{"CREATE TABLE t (x INT)", "SELECT x FROM t", "BEGIN; COMMIT"} {
		w := call(h, "POST", "/query", `{"sql":"`+sql+`","confirmed":true}`)
		var res struct {
			Columns []string         `json:"columns"`
			Rows    []map[string]any `json:"rows"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &res); err != nil || res.Columns == nil || res.Rows == nil {
			t.Errorf("%q: %d %s: columns and rows must be arrays, never null", sql, w.Code, w.Body)
		}
	}
}

func TestReadOnlySwitch(t *testing.T) {
	h := newAPI(t)
	if w := call(h, "GET", "/connection/read-only", ""); w.Code != http.StatusUnauthorized {
		t.Fatalf("without a connection: %d %s, want 401", w.Code, w.Body)
	}
	uri := "sqlite://" + filepath.Join(t.TempDir(), "ro.db")
	if w := call(h, "POST", "/connect", `{"uri":"`+uri+`","name":"ro"}`); w.Code != http.StatusOK {
		t.Fatalf("connect: %d %s", w.Code, w.Body)
	}
	call(h, "POST", "/query", `{"sql":"CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT); INSERT INTO t VALUES (1, 'a')","confirmed":true}`)

	for _, c := range []struct{ method, body, want string }{
		{"GET", "", `{"readOnly":false}`},
		{"PUT", `{"readOnly":true}`, `{"readOnly":true}`},
		{"GET", "", `{"readOnly":true}`},
	} {
		w := call(h, c.method, "/connection/read-only", c.body)
		if w.Code != http.StatusOK || strings.TrimSpace(w.Body.String()) != c.want {
			t.Fatalf("%s %s: %d %s, want %s", c.method, c.body, w.Code, w.Body, c.want)
		}
	}
	if w := call(h, "PUT", "/connection/read-only", `{}`); w.Code != http.StatusBadRequest {
		t.Errorf("missing readOnly: %d, want 400", w.Code)
	}
	if w := call(h, "PATCH", "/rows/t", `{"key":{"id":"1"},"column":"v","value":"b"}`); w.Code != http.StatusConflict {
		t.Errorf("edit while read-only: %d %s, want 409", w.Code, w.Body)
	}
}

func TestSeedReportsSkippedRows(t *testing.T) {
	h := newAPI(t)
	uri := "sqlite://" + filepath.Join(t.TempDir(), "seed.db")
	if w := call(h, "POST", "/connect", `{"uri":"`+uri+`","name":"seed"}`); w.Code != http.StatusOK {
		t.Fatalf("connect: %d %s", w.Code, w.Body)
	}
	call(h, "POST", "/query", `{"sql":"CREATE TABLE flags (id INTEGER PRIMARY KEY, on_off BOOLEAN NOT NULL UNIQUE)","confirmed":true}`)

	w := call(h, "POST", "/seed", `{"rowsPerTable":4}`)
	var res struct {
		RowsInserted map[string]int    `json:"rowsInserted"`
		Skipped      map[string]int    `json:"skipped"`
		Problems     map[string]string `json:"problems"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &res); err != nil || w.Code != http.StatusOK {
		t.Fatalf("seed: %d %s", w.Code, w.Body)
	}
	if res.RowsInserted["flags"] != 2 || res.Skipped["flags"] != 2 || !strings.Contains(res.Problems["flags"], "UNIQUE") {
		t.Fatalf("seed = %s, want 2 inserted, 2 skipped and the reason", w.Body)
	}
}

func TestExportFormatsAreListedAndRendered(t *testing.T) {
	h := newAPI(t)
	w := call(h, "GET", "/export", "")
	var list struct {
		Formats []struct{ ID, Label, Language, Filename string }
	}
	if err := json.Unmarshal(w.Body.Bytes(), &list); err != nil || w.Code != http.StatusOK {
		t.Fatalf("list: %d %s", w.Code, w.Body)
	}
	var ids []string
	for _, f := range list.Formats {
		if f.Label == "" || f.Language == "" || f.Filename == "" {
			t.Errorf("format %q is missing display fields: %+v", f.ID, f)
		}
		ids = append(ids, f.ID)
	}
	if strings.Join(ids, ",") != "sql,prisma,drizzle,dbml,mermaid" {
		t.Fatalf("formats = %v, want sql,prisma,drizzle,dbml,mermaid in order", ids)
	}

	// Unknown formats are not found, connected or not.
	if w := call(h, "GET", "/export/nope", ""); w.Code != http.StatusNotFound {
		t.Fatalf("unknown format before connecting: %d %s", w.Code, w.Body)
	}
	uri := "sqlite://" + filepath.Join(t.TempDir(), "x.db")
	if w := call(h, "POST", "/connect", `{"uri":"`+uri+`"}`); w.Code != http.StatusOK {
		t.Fatalf("connect: %d %s", w.Code, w.Body)
	}
	if w := call(h, "POST", "/query", `{"sql":"CREATE TABLE t (id INTEGER PRIMARY KEY)","confirmed":true}`); w.Code != http.StatusOK {
		t.Fatalf("create: %d %s", w.Code, w.Body)
	}
	if w := call(h, "GET", "/export/nope", ""); w.Code != http.StatusNotFound {
		t.Fatalf("unknown format: %d %s", w.Code, w.Body)
	}
	w = call(h, "GET", "/export/drizzle", "")
	var out struct{ Format, Schema string }
	if err := json.Unmarshal(w.Body.Bytes(), &out); err != nil || w.Code != http.StatusOK {
		t.Fatalf("drizzle: %d %s", w.Code, w.Body)
	}
	if out.Format != "drizzle" || !strings.Contains(out.Schema, "sqliteTable('t'") {
		t.Fatalf("drizzle export = %+v", out)
	}
}

func TestTableDDL(t *testing.T) {
	h := newAPI(t)
	uri := "sqlite://" + filepath.Join(t.TempDir(), "ddl.db")
	if w := call(h, "POST", "/connect", `{"uri":"`+uri+`"}`); w.Code != http.StatusOK {
		t.Fatalf("connect: %d %s", w.Code, w.Body)
	}
	call(h, "POST", "/query", `{"sql":"CREATE TABLE owners (id INTEGER PRIMARY KEY); CREATE TABLE pets (id INTEGER PRIMARY KEY AUTOINCREMENT, owner_id INTEGER REFERENCES owners (id) ON DELETE CASCADE, name TEXT NOT NULL); CREATE INDEX pets_name ON pets (name)","confirmed":true}`)

	w := call(h, "GET", "/tables/pets/ddl", "")
	var res struct{ DDL string }
	if err := json.Unmarshal(w.Body.Bytes(), &res); err != nil || w.Code != http.StatusOK {
		t.Fatalf("ddl: %d %s", w.Code, w.Body)
	}
	for _, part := range []string{
		`CREATE TABLE "pets"`, `"id" INTEGER PRIMARY KEY AUTOINCREMENT`, `"name" TEXT NOT NULL`,
		`REFERENCES "owners" ("id") ON DELETE CASCADE`, `CREATE INDEX "pets_name" ON "pets" ("name")`,
	} {
		if !strings.Contains(res.DDL, part) {
			t.Errorf("ddl lacks %q:\n%s", part, res.DDL)
		}
	}
	if strings.Contains(res.DDL, `CREATE TABLE "owners"`) {
		t.Errorf("ddl has another table:\n%s", res.DDL)
	}
	if w := call(h, "GET", "/tables/nope/ddl", ""); w.Code != http.StatusBadRequest {
		t.Fatalf("unknown table: %d %s", w.Code, w.Body)
	}
}
