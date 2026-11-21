package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os/signal"
	"syscall"

	"charm.land/lipgloss/v2"
	"github.com/knnedy/nexusql/internal/config"
	_ "github.com/knnedy/nexusql/internal/db/mysql"
	_ "github.com/knnedy/nexusql/internal/db/postgres"
	_ "github.com/knnedy/nexusql/internal/db/sqlite"
	"github.com/knnedy/nexusql/internal/projects"
	"github.com/knnedy/nexusql/internal/server"
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

	srv := server.New(server.Options{
		Addr:     cfg.Addr(),
		IsDev:    cfg.IsDev,
		Version:  Version,
		Session:  session.NewStore(),
		Projects: proj,
	})

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	printBanner(cfg.Addr(), cfg.IsDev)
	if err := server.Run(ctx, srv); err != nil {
		log.Fatalf("server error: %v", err)
	}

	fmt.Println("NexusQL stopped")
}
