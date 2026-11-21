import { expect, test, type Page } from "@playwright/test";
import { connectSqlite } from "./helpers";

const SETUP = `CREATE TABLE pets (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, nick TEXT, age INTEGER CHECK (age >= 0));
INSERT INTO pets (name, nick, age) VALUES ('Rex', 'rexy', 3), ('Tom', '', 5)`;

async function openPets(page: Page) {
  await page.getByRole("button", { name: "Explorer" }).click();
  await page.getByRole("button", { name: /pets/ }).click();
  await expect(page.getByText("Rex", { exact: true })).toBeVisible();
}

async function sql(page: Page, query: string) {
  const res = await page.request.post("/api/query", { data: { sql: query } });
  return (await res.json()).rows as Record<string, unknown>[];
}

test("saves an edit and keeps the new value on screen", async ({ page }) => {
  await connectSqlite(page, SETUP);
  await openPets(page);
  await page.getByText("Rex", { exact: true }).dblclick();
  await page.keyboard.type("Rexford");
  await page.keyboard.press("Enter");
  await expect(page.getByText("1 unsaved change")).toBeVisible();
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(page.getByText("1 unsaved change")).toBeHidden();
  await expect(page.getByText("Rexford", { exact: true })).toBeVisible();
  expect(await sql(page, "SELECT name FROM pets WHERE id = 1")).toEqual([{ name: "Rexford" }]);
});

test("writes NULL, not an empty string", async ({ page }) => {
  await connectSqlite(page, SETUP);
  await openPets(page);
  await page.getByText("empty", { exact: true }).dblclick(); // Tom's nick is ''
  await page.getByRole("button", { name: "Set NULL" }).click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("unsaved change")).toBeHidden();
  expect(await sql(page, "SELECT nick IS NULL AS n FROM pets WHERE id = 2")).toEqual([{ n: 1 }]);
});

test("a rejected edit stays with the database's reason", async ({ page }) => {
  await connectSqlite(page, SETUP);
  await openPets(page);
  await page.getByText("3", { exact: true }).dblclick();
  await page.keyboard.type("-1");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Save changes" }).click();

  await expect(page.getByText("1 unsaved change · 1 failed")).toBeVisible();
  await expect(page.getByLabel(/Save failed: .*CHECK constraint failed/)).toBeVisible();
  expect(await sql(page, "SELECT age FROM pets WHERE id = 1")).toEqual([{ age: 3 }]);
});

test("a read-only connection makes the grid read-only", async ({ page }) => {
  await connectSqlite(page, SETUP);
  await page.request.put("/api/connection/read-only", { data: { readOnly: true } });
  await openPets(page);
  await expect(page.getByRole("status")).toContainText("read-only");
  const inputs = await page.getByRole("textbox").count(); // search and the like
  await page.getByText("Rex", { exact: true }).dblclick();
  await expect(page.getByRole("textbox")).toHaveCount(inputs);
});
