import { expect, test } from "@playwright/test";
import { connectSqlite } from "./helpers";

test("draws a key that references a unique column", async ({ page }) => {
  await connectSqlite(page, `CREATE TABLE skus (id INTEGER PRIMARY KEY, code TEXT UNIQUE);
    CREATE TABLE lines (id INTEGER PRIMARY KEY, sku_code TEXT REFERENCES skus (code))`);
  await page.reload();
  await expect(page.locator(".react-flow__node")).toHaveCount(2);
  await expect(page.locator(".react-flow__edge")).toHaveCount(1);
});
