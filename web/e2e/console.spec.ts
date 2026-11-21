import { expect, test } from "@playwright/test";
import { connectSqlite } from "./helpers";

test("runs a query from the SQL console", async ({ page }) => {
  await connectSqlite(page, "CREATE TABLE pets (id INTEGER PRIMARY KEY, name TEXT); INSERT INTO pets (name) VALUES ('Rex'), ('Tom')");
  await page.getByRole("button", { name: "Open sidebar" }).click();
  await page.getByRole("button", { name: /SQL Console/ }).click();
  const editor = page.getByPlaceholder("SELECT * FROM users LIMIT 10;");
  await editor.fill("SELECT name FROM pets ORDER BY id");
  await editor.press("Control+Enter");
  await expect(page.getByText("2 rows")).toBeVisible();
  await expect(page.getByRole("cell", { name: "Rex" })).toBeVisible();
});
