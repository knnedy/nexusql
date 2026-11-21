import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

// The shipped binary serves the embedded UI; `make e2e` builds it first.
// A throwaway HOME keeps the saved-projects file out of the real one.
const port = 7499;
const home = mkdtempSync(join(tmpdir(), "nexusql-e2e-"));

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false, // one server, one active connection
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `../bin/nexusql -port ${port}`,
    url: `http://127.0.0.1:${port}/api/health`,
    env: { HOME: home },
    reuseExistingServer: false,
  },
});
