import { expect, test } from "@playwright/test";
import { connectSqlite } from "./helpers";
import { generateSchema } from "../src/test/schema-gen";

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

// Forty tables that all reference users (a hub), and every odd one its neighbour.
const HUB = [
  "CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT)",
  ...Array.from({ length: 40 }, (_, i) =>
    `CREATE TABLE a${i} (id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users (id)` +
    (i % 2 ? `, prev_id INTEGER REFERENCES a${i - 1} (id))` : ")"),
  ),
].join(";\n");

test("lines into a hub table show as chips until either end is in focus", async ({ page }) => {
  await connectSqlite(page, HUB);
  await page.reload();
  const a1 = page.locator('.react-flow__node[data-id="a1"]');
  await expect(a1).toBeVisible();
  await expect(page.locator("[data-hub]")).toHaveCount(0);
  await expect(a1.getByRole("button", { name: "Go to users" })).toBeVisible();

  // Focus a1: its hub line appears, its own edges light up, the rest dim.
  await a1.hover();
  await expect(page.locator("[data-hub]")).toHaveCount(1);
  await expect(page.locator('[data-focus="on"]')).toHaveCount(2);
  await expect(page.locator('[data-focus="off"]').first()).toBeAttached();

  await page.mouse.move(5, 700);
  await expect(page.locator("[data-hub]")).toHaveCount(0);
  await expect(page.locator('[data-focus="on"]')).toHaveCount(0);

  // The chip jumps to users and keeps it in focus, so its lines show.
  await a1.getByRole("button", { name: "Go to users" }).click();
  await page.mouse.move(5, 700);
  const users = page.locator('.react-flow__node[data-id="users"]');
  await expect.poll(async () => {
    const b = await users.boundingBox();
    const v = (await page.locator(".react-flow").boundingBox())!; // the diagram, not the window
    const [cx, cy] = [v.x + v.width / 2, v.y + v.height / 2];
    return !!b && Math.abs(b.x + b.width / 2 - cx) < 40 && Math.abs(b.y + b.height / 2 - cy) < 40;
  }).toBe(true);
  await expect.poll(() => page.locator("[data-hub]").count()).toBeGreaterThan(0);
});

test("the first view fits every table of a large schema", async ({ page }) => {
  // The 400-table generated schema: modules, hubs and lone tables.
  const { tables, relations } = generateSchema(400);
  const sql = tables.map((t) => {
    const cols = t.fields.map((f) => {
      const r = relations.find((x) => x.sourceTable === t.name && x.sourceField === f.name);
      const ref = r ? ` REFERENCES ${r.targetTable} (${r.targetField})` : "";
      return `${f.name} ${f.isPrimaryKey ? "INTEGER PRIMARY KEY" : f.nativeType.toUpperCase()}${ref}`;
    });
    return `CREATE TABLE ${t.name} (${cols.join(", ")})`;
  });
  await connectSqlite(page, sql.join(";\n"));
  await page.reload();
  await expect(page.locator(".react-flow__node").first()).toBeVisible({ timeout: 20_000 });
  const pane = (await page.locator(".react-flow").boundingBox())!;
  await expect.poll(async () => {
    const boxes = await page.locator(".react-flow__node").evaluateAll((els) =>
      els.map((e) => e.getBoundingClientRect()).map((r) => [r.left, r.top, r.right, r.bottom]),
    );
    const inside = boxes.filter(([l, t, r, b]) => l >= pane.x - 1 && t >= pane.y - 1 && r <= pane.x + pane.width + 1 && b <= pane.y + pane.height + 1);
    return [boxes.length, inside.length];
  }).toEqual([400, 400]);
});
