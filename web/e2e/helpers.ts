import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, type Page } from "@playwright/test";

/** Connects through the UI to a fresh SQLite file and runs setup SQL. */
export async function connectSqlite(page: Page, setupSql = ""): Promise<string> {
  const file = join(mkdtempSync(join(tmpdir(), "nexusql-db-")), "e2e.db");
  await page.goto("/");
  await page.getByRole("button", { name: /SQLite/ }).click();
  await page.getByLabel("Project name").fill(`e2e ${Date.now()}`);
  await page.getByLabel("Connection URI").fill(`sqlite://${file}`);
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
