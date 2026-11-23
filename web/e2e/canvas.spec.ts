import { expect, test } from "@playwright/test";
import { connectSqlite } from "./helpers";

test("draws a key that references a unique column", async ({ page }) => {
  await connectSqlite(page, `CREATE TABLE skus (id INTEGER PRIMARY KEY, code TEXT UNIQUE);
    CREATE TABLE lines (id INTEGER PRIMARY KEY, sku_code TEXT REFERENCES skus (code))`);
  await page.reload();
  await expect(page.locator(".react-flow__node")).toHaveCount(2);
  await expect(page.locator(".react-flow__edge")).toHaveCount(1);
});

// Six tables and six keys, with a shared parent: enough for ELK to bend some routes.
const SHOP = `CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT);
  CREATE TABLE orders (id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users (id), total REAL);
  CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT, price REAL);
  CREATE TABLE items (id INTEGER PRIMARY KEY, order_id INTEGER REFERENCES orders (id),
    product_id INTEGER REFERENCES products (id), qty INTEGER);
  CREATE TABLE reviews (id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users (id),
    product_id INTEGER REFERENCES products (id), body TEXT);
  CREATE TABLE refunds (id INTEGER PRIMARY KEY, item_id INTEGER REFERENCES items (id))`;

test("edges follow the layout's routes, and a dragged table falls back until re-layout", async ({ page }) => {
  await connectSqlite(page, SHOP);
  await page.reload();
  const edges = page.locator(".react-flow__edge");
  await expect(edges).toHaveCount(6);
  // Every route ends at its handles: the drawn tables match the sizes the layout used.
  await expect(page.locator('[data-routed="true"]')).toHaveCount(6);

  const refunds = page.locator(".react-flow__node", { hasText: "refunds" });
  const box = (await refunds.boundingBox())!;
  await page.mouse.move(box.x + 40, box.y + 15);
  await page.mouse.down();
  await page.mouse.move(box.x + 40, box.y + 215, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator('[data-routed="false"]')).toHaveCount(1);

  await page.getByRole("button", { name: "Open sidebar" }).click();
  await page.getByRole("button", { name: /Auto-layout/ }).click();
  await expect(page.locator('[data-routed="true"]')).toHaveCount(6);
});
