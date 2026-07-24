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

	"charm.land/lipgloss/v2"
	"github.com/go-chi/chi/v5"
	"github.com/knnedy/nexusql/internal/api"
	"github.com/knnedy/nexusql/internal/config"
	_ "github.com/knnedy/nexusql/internal/db/postgres"
	_ "github.com/knnedy/nexusql/internal/db/sqlite"
	"github.com/knnedy/nexusql/internal/projects"
	"github.com/knnedy/nexusql/internal/session"
)

// Version is set at build time via -ldflags "-X main.Version=..."
// (see .goreleaser.yaml). Defaults to "dev" for local builds.
var Version = "dev"

const wordmark = `
███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗ ██████╗ ██╗
████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝██╔═══██╗██║
██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗██║   ██║██║
██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║██║▄▄ ██║██║
██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║╚██████╔╝███████╗
╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝ ╚══▀▀═╝ ╚══════╝`

func printBanner(addr string, isDev bool) {
	teal := lipgloss.Color("#5DCAA5")
	coral := lipgloss.Color("#D85A30")
	textPrimary := lipgloss.Color("#F0EFEA")
	textSecondary := lipgloss.Color("#8A8A86")
	textTertiary := lipgloss.Color("#606060")

	logo := lipgloss.NewStyle().Foreground(teal).Render(wordmark)

	version := lipgloss.NewStyle().Foreground(textTertiary).Render("v" + Version)

	tagline := lipgloss.NewStyle().Foreground(textSecondary).
		Render("local-first SQL data studio")

	url := lipgloss.NewStyle().Bold(true).Foreground(textPrimary).
		Render("http://" + addr)

	mode := "production"
	modeColor := teal
	if isDev {
		mode = "development"
		modeColor = coral
	}
	modeStyled := lipgloss.NewStyle().Foreground(modeColor).Render(mode)

	label := lipgloss.NewStyle().Foreground(textTertiary)

	fmt.Println(logo)
	fmt.Println()
	fmt.Printf("  %s   %s\n", version, tagline)
	fmt.Printf("  %s  %s\n", label.Render("running at"), url)
	fmt.Printf("  %s        %s\n", label.Render("mode"), modeStyled)
	fmt.Println()
}

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
		printBanner(cfg.Addr(), cfg.IsDev)
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
