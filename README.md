# NexusQL

A local-first SQL data studio with a visual ERD canvas, spreadsheet-style data explorer, SQL console, and fake data seeding — supports Postgres, MySQL, and SQLite. No installation required — just download and run a single binary.

![NexusQL Studio](https://raw.githubusercontent.com/knnedy/nexusql/main/preview.png)

![NexusQL Explorer](https://raw.githubusercontent.com/knnedy/nexusql/main/preview.png)

---

## Features

- **Single binary** — no Node.js, no separate services. One file, run it anywhere.
- **Visual ERD canvas** — interactive schema graph with automatic layout, relation edges, and an inspector panel for tables and relations.
- **Data explorer** — spreadsheet-style grid with inline cell editing, server-side sorting/search/pagination, foreign-key navigation, and CSV export.
- **SQL console** — syntax-highlighted editor with query history, a confirmation gate on destructive queries, and JSON/CSV export of results.
- **Seed data generator** — populates every table with realistic fake data in dependency order, respecting foreign keys and enum constraints.
- **Schema export** — generate Prisma or Drizzle schema files directly from an introspected database.
- **Multi-provider** — works with Postgres, MySQL, and SQLite through a common provider interface.
- **Dark & light theme** — clean, modern UI, toggleable at runtime.

---

## Installation

### Download the binary

```bash
curl -fsSL https://raw.githubusercontent.com/knnedy/nexusql/main/install.sh | sh
```

Then run:

```bash
nexusql
```

Open your browser at `http://localhost:8080` (or the port printed in your terminal).

> The install script and released binaries assume Linux/macOS. If you're on Windows, build from source (below) for now.

---

## Usage

```
Usage of nexusql:
  -host string
        network interface to bind (default "0.0.0.0")
  -port int
        TCP port for the web server (default 8080)
  -version
        print version and exit
```

### Examples

```bash
# run with defaults
nexusql

# run on a custom port
nexusql -port 9090

# restrict to localhost only
nexusql -host 127.0.0.1

# check version
nexusql -version
```

On first launch, connect to a database using a connection URI (`postgres://`, `mysql://`, or `sqlite://`) and NexusQL will introspect the schema and open the Canvas view.

---

## Studio

| Mode         | Contents                                                                                                                           |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Canvas**   | Interactive ERD graph · auto-layout · table/relation inspector · SQL console · seed generator · Prisma/Drizzle export · PNG export |
| **Explorer** | Table list · sortable/searchable data grid · inline cell editing · foreign-key navigation · CSV export                             |

---

## Manual Installation

If you prefer to install manually:

```bash
# amd64
curl -L https://github.com/knnedy/nexusql/releases/latest/download/nexusql_linux_amd64.tar.gz | tar -xz
sudo mv nexusql /usr/local/bin/

# arm64 (Apple Silicon, ARM servers)
curl -L https://github.com/knnedy/nexusql/releases/latest/download/nexusql_linux_arm64.tar.gz | tar -xz
sudo mv nexusql /usr/local/bin/
```

---

## Building from Source

**Requirements**

- Go 1.22+
- Node.js 18+
- pnpm

```bash
git clone https://github.com/knnedy/nexusql.git
cd nexusql
make build
./bin/nexusql
```

For frontend-only development with hot reload:

```bash
cd web
pnpm install
pnpm dev
```

> `make build` and any additional targets (e.g. `make dev`) should be confirmed against the project's actual `Makefile` — update this section if the target names differ.

---

## Verifying Downloads

```bash
curl -L https://github.com/knnedy/nexusql/releases/download/v0.1.0/checksums.txt -o checksums.txt
sha256sum -c checksums.txt
```

---

## Uninstalling

```bash
sudo rm /usr/local/bin/nexusql
```

---

## Tech Stack

| Layer        | Technology                                                                                               |
| ------------ | -------------------------------------------------------------------------------------------------------- |
| Backend      | Go, `chi/v5`, `pgx/v5`, provider interface for Postgres/MySQL/SQLite                                     |
| Frontend     | Next.js, TypeScript, Tailwind CSS, TanStack Query, TanStack Table, React Flow (`@xyflow/react`), Zustand |
| Fake data    | [GoFakeIt](https://github.com/brianvoe/gofakeit)                                                         |
| Distribution | Single binary via `go:embed`                                                                             |

---

## License

MIT © 2026 [knnedy](https://github.com/knnedy) — see [LICENSE](LICENSE) for details.
