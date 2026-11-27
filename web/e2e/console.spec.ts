import { expect, test } from "@playwright/test";
import { connectSqlite } from "./helpers";

test("runs a query from the SQL console", async ({ page }) => {
  await connectSqlite(page, "CREATE TABLE pets (id INTEGER PRIMARY KEY, name TEXT); INSERT INTO pets (name) VALUES ('Rex'), ('Tom')");
  await page.getByRole("button", { name: "Expand SQL" }).click();
  const editor = page.getByPlaceholder("SELECT * FROM users LIMIT 10;");
  await editor.fill("SELECT name FROM pets ORDER BY id");
  await editor.press("Control+Enter");
  await expect(page.getByRole("region", { name: "SQL" }).getByRole("status")).toContainText("2 rows");
  await expect(page.getByRole("cell", { name: "Rex" })).toBeVisible();
});

test("names each column's type, and fixes a misspelt table from the error", async ({ page }) => {
  await connectSqlite(page, "CREATE TABLE pets (id INTEGER PRIMARY KEY, name TEXT); INSERT INTO pets (name) VALUES ('Rex')");
  await page.getByRole("button", { name: "Expand SQL" }).click();
  const editor = page.getByPlaceholder("SELECT * FROM users LIMIT 10;");
  await editor.fill("SELECT id, name\nFROM pet");
  await editor.press("Control+Enter");
  await expect(page.getByText("Line 2.")).toBeVisible();
  await page.getByRole("region", { name: "SQL" }).getByRole("button", { name: "pets" }).click();
  await expect(editor).toHaveValue("SELECT id, name\nFROM pets");
  await editor.press("Control+Enter");
  await expect(page.getByRole("columnheader", { name: /id\s*integer/ })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Rex" })).toBeVisible();
});

test("a table created in the console appears on the canvas", async ({ page }) => {
  await connectSqlite(page, "CREATE TABLE pets (id INTEGER PRIMARY KEY)");
  await page.keyboard.press("Control+j");
  const editor = page.getByPlaceholder("SELECT * FROM users LIMIT 10;");
  await editor.fill("CREATE TABLE owners (id INTEGER PRIMARY KEY, name TEXT)");
  await editor.press("Control+Enter");
  await page.getByRole("button", { name: "Confirm & Run" }).click();
  await expect(page.getByText(/rows affected/)).toBeVisible();
  await page.getByRole("button", { name: "Collapse SQL" }).click();
  await expect(page.getByText("owners", { exact: true }).first()).toBeVisible();
});
