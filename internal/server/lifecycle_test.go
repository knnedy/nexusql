package server_test

import (
	"context"
	"testing"
	"time"

	"github.com/knnedy/nexusql/internal/db"
	"github.com/knnedy/nexusql/internal/db/dbtest"
	_ "github.com/knnedy/nexusql/internal/db/sqlite"
	"github.com/knnedy/nexusql/internal/projects"
	"github.com/knnedy/nexusql/internal/server"
	"github.com/knnedy/nexusql/internal/session"
)

func TestShutdownClosesTheDatabase(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	proj, err := projects.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	conn, err := db.Connect(context.Background(), dbtest.SQLiteFile(t, "a.db"), db.Options{})
	if err != nil {
		t.Fatal(err)
	}
	sess := session.NewStore()
	if err := sess.Set(conn); err != nil {
		t.Fatal(err)
	}

	srv := server.New(server.Options{Addr: "127.0.0.1:0", Session: sess, Projects: proj})
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- server.Run(ctx, srv) }()
	time.Sleep(100 * time.Millisecond)
	cancel()

	select {
	case err := <-done:
		if err != nil {
			t.Fatal(err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("server did not stop")
	}
	if sess.IsConnected() {
		t.Fatal("database connection still open after shutdown")
	}
}

func TestWriteTimeoutOutlastsQueries(t *testing.T) {
	srv := server.New(server.Options{Addr: "127.0.0.1:0", Session: session.NewStore(), QueryTimeout: time.Minute})
	if srv.WriteTimeout <= time.Minute {
		t.Fatalf("WriteTimeout %s, want longer than the 1m query timeout", srv.WriteTimeout)
	}
}
