import { expect, test } from "@playwright/test";
import { connectSqlite } from "./helpers";

test("lists the server's export formats and renders the chosen one", async ({ page }) => {
  await connectSqlite(page, "CREATE TABLE pets (id INTEGER PRIMARY KEY, name TEXT NOT NULL)");
  await page.getByRole("tab", { name: "Export" }).click();
  await expect(page.getByRole("button", { name: /Prisma schema/ })).toBeVisible();
  await page.getByRole("button", { name: /Drizzle schema/ }).click();
  await expect(page.getByText(/sqliteTable\('pets'/)).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download schema.ts" }).click();
  expect((await download).suggestedFilename()).toBe("schema.ts");
});

test("the details card shows the server's DDL for the selected table", async ({ page }) => {
  await connectSqlite(page, "CREATE TABLE pets (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL)");
  await page.reload();
  await page.getByText("pets", { exact: true }).first().click();
  await page.getByRole("button", { name: "Show DDL" }).click();
  await expect(page.getByText(/"id" INTEGER PRIMARY KEY AUTOINCREMENT/)).toBeVisible();
});

test("the details card lists the keys, indexes and checks the database has", async ({ page }) => {
  await connectSqlite(page, `CREATE TABLE owners (id INTEGER PRIMARY KEY);
    CREATE TABLE pets (id INTEGER PRIMARY KEY, owner_id INTEGER REFERENCES owners (id) ON DELETE CASCADE,
      tag TEXT UNIQUE, age INTEGER CONSTRAINT age_ok CHECK (age >= 0));
    CREATE INDEX pets_age_idx ON pets (age)`);
  await page.reload();
  await page.getByText("pets", { exact: true }).first().click();
  await expect(page.getByText("(owner_id) → owners (id) · ON DELETE CASCADE")).toBeVisible();
  await expect(page.getByText("(tag)", { exact: true })).toBeVisible();
  await expect(page.getByText("pets_age_idx")).toBeVisible();
  await expect(page.getByText("age_ok")).toBeVisible();
  await expect(page.getByText("fk_pets_owner_id")).toHaveCount(0); // the old client-made name
});
