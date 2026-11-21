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
	return api.Router(studio.New(sess, proj), api.Config{})
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
