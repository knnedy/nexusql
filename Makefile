.PHONY: build go-build web-build run dev test test-integration e2e vet web-check check clean

UI_DIST := internal/ui/dist

# Full binary with the frontend embedded.
build: web-build
	$(MAKE) go-build

# Go-only build; embeds whatever is in $(UI_DIST) (a build hint page if empty).
go-build:
	go build -o bin/nexusql ./cmd/nexusql

web-build:
	cd web && pnpm install --frozen-lockfile && pnpm run build
	@test -f web/out/index.html || \
		(echo "ERROR: web/out/index.html not found. Frontend build failed." && exit 1)
	find $(UI_DIST) -mindepth 1 ! -name .gitkeep -delete
	cp -r web/out/. $(UI_DIST)/

run: build
	./bin/nexusql

dev:
	@trap 'kill 0' EXIT INT TERM; \
	echo "Starting GO backend on :7080 (air hot-reload)..."; \
	NEXUSQL_ENV=development air & \
	echo "Starting Next.js dev server on :3000..."; \
	cd web && pnpm dev; \
	wait

test:
	go test ./...

# Postgres/MySQL conformance tests in Docker containers (testcontainers-go).
test-integration:
	go test -tags integration ./...

# Browser tests against the built binary (first run: pnpm exec playwright install chromium).
e2e: build
	cd web && pnpm e2e

vet:
	go vet ./...

web-check:
	cd web && pnpm typecheck && pnpm lint && pnpm test && pnpm build

# Everything CI runs.
check: vet test go-build web-check

clean:
	rm -rf web/out web/.next bin
	find $(UI_DIST) -mindepth 1 ! -name .gitkeep -delete
