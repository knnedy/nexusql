import { expect, test } from "@playwright/test";
import { connectSqlite } from "./helpers";

const PETS =
  "CREATE TABLE owners (id INTEGER PRIMARY KEY, name TEXT NOT NULL); CREATE TABLE pets (id INTEGER PRIMARY KEY AUTOINCREMENT, owner_id INTEGER NOT NULL REFERENCES owners (id), name TEXT NOT NULL, kind TEXT NOT NULL CHECK (kind IN ('cat', 'dog')))";

test("plans a seed, samples it, adds the rows and reports them", async ({ page }) => {
  await connectSqlite(page, PETS);
  await page.goto("/studio/?view=data&table=pets");
  await page.getByRole("button", { name: "Seed data" }).click();
  const dialog = page.getByRole("dialog", { name: "Seed data" });
  const plan = dialog.getByRole("list", { name: "Tables, in the order rows go in" });
  await expect(plan.getByRole("listitem")).toHaveText([/owners/, /pets\s*needs owners/]);

  const sample = dialog.getByRole("table", { name: "Sample rows of pets" });
  await expect(sample).toContainText("→ owners");
  await expect(sample.getByRole("cell", { name: /^(cat|dog)$/ })).toHaveCount(3);

  await dialog.getByRole("spinbutton", { name: "Rows for pets" }).fill("25");
  await dialog.getByRole("button", { name: "Add 35 rows" }).click();
  await expect(dialog.getByText("Added 35 rows to 2 tables.")).toBeVisible();
  await dialog.getByRole("button", { name: "Open pets" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(/25 rows/).first()).toBeVisible();

  // Left out, owners keep their rows; new pets point at them.
  await page.getByRole("button", { name: "Seed data" }).click();
  await dialog.getByRole("checkbox", { name: "Seed owners" }).uncheck();
  await expect(plan.getByRole("listitem", { name: "pets" })).toContainText("existing owners rows");
  await dialog.getByRole("button", { name: "Add 10 rows" }).click();
  await expect(dialog.getByText("Added 10 rows to 1 table.")).toBeVisible();
});
