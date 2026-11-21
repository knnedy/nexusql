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
	"github.com/knnedy/nexusql/internal/studio"
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

func printBanner(cfg config.Config) {
	teal := lipgloss.Color("#5DCAA5")
	coral := lipgloss.Color("#D85A30")
	textPrimary := lipgloss.Color("#F0EFEA")
	textSecondary := lipgloss.Color("#8A8A86")
	textTertiary := lipgloss.Color("#606060")

	logo := lipgloss.NewStyle().Foreground(teal).Render(wordmark)

	version := lipgloss.NewStyle().Foreground(textTertiary).Render("v" + Version)

	tagline := lipgloss.NewStyle().Foreground(textSecondary).
		Render("local-first SQL data studio")

	link := "http://" + cfg.Addr() + "/"
	if cfg.Token != "" {
		link += "?token=" + cfg.Token
	}
	url := lipgloss.NewStyle().Bold(true).Foreground(textPrimary).Render(link)

	mode := "production"
	modeColor := teal
	if cfg.IsDev {
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
	if cfg.Expose {
		warn := lipgloss.NewStyle().Bold(true).Foreground(coral)
		fmt.Printf("  %s     %s\n", label.Render("exposed"),
			warn.Render("anyone with this URL has full access to the connected database"))
	}
	fmt.Println()
}

func main() {
	host := flag.String("host", "", "network interface to bind (default 127.0.0.1)")
	port := flag.String("port", "", "TCP port for the web server (default 7080)")
	expose := flag.Bool("expose", false, "allow a non-loopback -host; requires an access token")
	queryTimeout := flag.Duration("query-timeout", studio.DefaultQueryTimeout, "longest a single database statement may run")
	showVersion := flag.Bool("version", false, "print version and exit")
	flag.Parse()

	if *showVersion {
		fmt.Println("nexusql", Version)
		return
	}

	cfg, err := config.Load(config.Flags{Host: *host, Port: *port, Expose: *expose})
	if err != nil {
		log.Fatal(err)
	}

	proj, err := projects.NewStore()
	if err != nil {
		log.Fatalf("failed to initialise project store: %v", err)
	}

	srv := server.New(server.Options{
		Addr:         cfg.Addr(),
		IsDev:        cfg.IsDev,
		Token:        cfg.Token,
		QueryTimeout: *queryTimeout,
		Version:      Version,
		Session:      session.NewStore(),
		Projects:     proj,
	})

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	printBanner(cfg)
	if err := server.Run(ctx, srv); err != nil {
		log.Fatalf("server error: %v", err)
	}

	fmt.Println("NexusQL stopped")
}
