import { expect, test } from "@playwright/test";
import { connectSqlite } from "./helpers";

const SHOP = `CREATE TABLE customers (id INTEGER PRIMARY KEY, email TEXT);
  CREATE TABLE orders (id INTEGER PRIMARY KEY, customer_id INTEGER REFERENCES customers (id));
  CREATE TABLE order_items (id INTEGER PRIMARY KEY, order_id INTEGER REFERENCES orders (id));
  CREATE TABLE audit_log (id INTEGER PRIMARY KEY, note TEXT)`;

test("following links builds a trail that leads back", async ({ page }) => {
  await connectSqlite(page, SHOP);
  const tables = page.getByRole("complementary", { name: "Tables" });
  await tables.getByRole("button", { name: /^customers/ }).click();
  await tables.getByRole("region", { name: /Linked to customers/ }).getByRole("button", { name: /orders/ }).click();
  await tables.getByRole("region", { name: /Linked to orders/ }).getByRole("button", { name: /order_items/ }).click();

  const trail = page.getByRole("navigation", { name: "Relationship trail" });
  await expect(trail.getByRole("button")).toHaveText(["customers", "orders", "order_items"]);
  await expect(trail).toContainText("customer_id");

  await trail.getByRole("button", { name: "customers" }).click();
  await expect(page).toHaveURL(/table=customers/);
  await expect(trail.getByRole("button", { name: "customers" })).toHaveAttribute("aria-current", "location");

  await tables.getByRole("button", { name: /^audit_log/ }).click();
  await expect(trail).toHaveCount(0); // nothing links it to customers
});

test("Ctrl+K goes to a table or a column's table; / and Ctrl+B work the sidebar", async ({ page }) => {
  await connectSqlite(page, SHOP);
  await page.keyboard.press("Control+k");
  const box = page.getByRole("combobox", { name: "Search" });
  await box.fill("order_it");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/table=order_items/);
  await expect(box).toHaveCount(0);

  await page.getByRole("button", { name: /Go to a table/ }).click();
  await box.fill("customer_id");
  await expect(page.getByRole("option", { selected: true })).toContainText("orders");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/table=orders/);

  await page.keyboard.press("/");
  await expect(page.getByRole("textbox", { name: "Filter tables" })).toBeFocused();
  await page.keyboard.press("Escape");
  await page.locator("body").click({ position: { x: 700, y: 400 } });
  await page.keyboard.press("Control+b");
  await expect(page.getByRole("button", { name: "Show tables" })).toBeVisible();
});
