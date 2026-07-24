package main

import (
	"context"
	"flag"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/knnedy/nexusql/internal/api"
	"github.com/knnedy/nexusql/internal/config"
	_ "github.com/knnedy/nexusql/internal/db/postgres"
	"github.com/knnedy/nexusql/internal/projects"
	"github.com/knnedy/nexusql/internal/session"
)

// Version is set at build time via -ldflags "-X main.Version=..."
// (see .goreleaser.yaml). Defaults to "dev" for local builds.
var Version = "dev"

func main() {
	host := flag.String("host", "", "network interface to bind (default 127.0.0.1)")
	port := flag.String("port", "", "TCP port for the web server (default 7080)")
	showVersion := flag.Bool("version", false, "print version and exit")
	flag.Parse()

	if *showVersion {
		fmt.Println("nexusql", Version)
		return
	}

	cfg := config.Load(*host, *port)

	proj, err := projects.NewStore()
	if err != nil {
		log.Fatalf("failed to initialise project store: %v", err)
	}

	sess := session.NewStore()

	r := chi.NewRouter()
	r.Mount("/api", api.Router(sess, proj, cfg.IsDev))

	sub, err := fs.Sub(staticFiles, "out")
	if err != nil {
		log.Fatalf("failed to sub static files: %v", err)
	}
	r.Handle("/*", http.FileServer(http.FS(sub)))

	srv := &http.Server{
		Addr:         cfg.Addr(),
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		fmt.Printf("NexusQL running on http://%s\n", cfg.Addr())
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	<-quit

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("shutdown error: %v", err)
	}

	fmt.Println("NexusQL stopped")
}
