.PHONY: build clean run dev web-build go-build

build: web-build go-build

web-build:
	cd web && pnpm install && pnpm run build
	@test -f web/out/index.html || \
		(echo "ERROR: web/out/index.html not found. Frontend build failed." && exit 1)
	rm -rf cmd/nexusql/out
	cp -r web/out cmd/nexusql/out

go-build: web-build
	go build -o bin/nexusql ./cmd/nexusql

run: build
	./bin/nexusql

dev:
	@echo "Starting Go backend..."
	go run ./cmd/nexusql &
	@echo "Starting Next.js dev server..."
	cd web && pnpm dev

clean:
	rm -rf web/out web/.next bin cmd/nexusql/out