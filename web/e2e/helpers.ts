import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, type Page } from "@playwright/test";

/** Creates a fresh SQLite file through the UI, connects, and runs setup SQL. */
export async function connectSqlite(page: Page, setupSql = ""): Promise<string> {
  const file = join(mkdtempSync(join(tmpdir(), "nexusql-db-")), "e2e.db");
  await page.goto("/");
  await page.getByRole("button", { name: /SQLite/ }).click();
  await page.getByLabel("Project name").fill(`e2e ${Date.now()}`);
  await page.getByLabel("Connection URI").fill(`sqlite://${file}`);
  await page.getByLabel("Create a new database file").check();
  await page.getByRole("button", { name: "Connect" }).click();
  await expect(page).toHaveURL(/\/studio/);
  if (setupSql) {
    const res = await page.request.post("/api/query", {
      data: { sql: setupSql, confirmed: true },
    });
    expect(res.ok(), await res.text()).toBeTruthy();
  }
  return file;
}
