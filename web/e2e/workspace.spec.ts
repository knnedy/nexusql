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
