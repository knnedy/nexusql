import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

test("a SQLite file is only created when asked", async ({ page }) => {
  const file = join(mkdtempSync(join(tmpdir(), "nexusql-db-")), "typo.db");
  await page.goto("/");
  await page.getByRole("button", { name: /PostgreSQL/ }).click();
  await expect(page.getByLabel("Create a new database file")).toHaveCount(0);

  await page.getByRole("button", { name: /SQLite/ }).click();
  await page.getByLabel("Project name").fill(`new ${Date.now()}`);
  await page.getByLabel("Connection URI").fill(`sqlite://${file}`);
  await page.getByRole("button", { name: "Connect" }).click();
  await expect(page.getByText(/no SQLite database at/)).toBeVisible();
  await expect(page).not.toHaveURL(/\/studio/);
  expect(existsSync(file)).toBe(false);

  await page.getByLabel("Create a new database file").check();
  await page.getByRole("button", { name: "Connect" }).click();
  await expect(page).toHaveURL(/\/studio/);
  expect(existsSync(file)).toBe(true);
});
