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

function header(page: Page, column: string) {
  return page.locator("th", { has: page.getByText(column, { exact: true }) });
}

test("hiding a column removes it from the grid", async ({ page }) => {
  await connectSqlite(page, SETUP);
  await openPets(page);
  await expect(header(page, "nick")).toHaveCount(1);
  await page.getByRole("button", { name: "Columns" }).click();
  await page.getByRole("button", { name: "nick", exact: true }).click();
  await page.getByRole("button", { name: /Columns/ }).click(); // close the menu
  await expect(header(page, "nick")).toHaveCount(0);
  await expect(page.getByText("rexy", { exact: true })).toBeHidden();
  await expect(page.getByText("Rex", { exact: true })).toBeVisible();
});

test("dragging a header edge resizes its column", async ({ page }) => {
  await connectSqlite(page, SETUP);
  await openPets(page);
  const th = header(page, "name");
  const before = (await th.boundingBox())!;
  const handle = (await th.locator(".cursor-col-resize").boundingBox())!;
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2 + 100, handle.y + handle.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect.poll(async () => (await th.boundingBox())!.width).toBeGreaterThan(before.width + 90);
});

async function addFilter(page: Page, column: string, op: string, value?: string) {
  await page.getByRole("button", { name: "Filters" }).click();
  const dialog = page.getByRole("dialog", { name: "Filters" });
  const columns = dialog.getByLabel("Filter column");
  await columns.last().selectOption(column);
  await dialog.getByLabel("Filter operator").last().selectOption({ label: op });
  if (value !== undefined) await dialog.getByLabel("Filter value").last().fill(value);
  await dialog.getByRole("button", { name: "Apply" }).click();
}

test("a filter narrows the rows, survives a reload, and its chip removes it", async ({ page }) => {
  await connectSqlite(page, SETUP);
  await openPets(page);
  await addFilter(page, "age", "≥", "4");
  await expect(page.getByText("Tom", { exact: true })).toBeVisible();
  await expect(page.getByText("Rex", { exact: true })).toBeHidden();

  await page.reload();
  await expect(page.getByText("age ≥ 4")).toBeVisible();
  await expect(page.getByText("Rex", { exact: true })).toBeHidden();

  await page.getByRole("button", { name: "Remove filter age ≥ 4" }).click();
  await expect(page.getByText("Rex", { exact: true })).toBeVisible();
});

test("is one of picks from a column's allowed values", async ({ page }) => {
  await connectSqlite(page, `CREATE TABLE sizes (id INTEGER PRIMARY KEY,
    s TEXT CHECK (s IN ('small', 'large')));
    INSERT INTO sizes (s) VALUES ('small'), ('large'), ('small')`);
  await page.getByRole("button", { name: "Explorer" }).click();
  await page.getByRole("button", { name: /sizes/ }).click();
  await page.getByRole("button", { name: "Filters" }).click();
  const dialog = page.getByRole("dialog", { name: "Filters" });
  await dialog.getByLabel("Filter column").selectOption("s");
  await dialog.getByLabel("Filter operator").selectOption({ label: "is one of" });
  await dialog.getByRole("button", { name: "large", exact: true }).click();
  await dialog.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText("s is one of large")).toBeVisible();
  await expect(page.getByText("small", { exact: true })).toHaveCount(0);
  await expect(page.getByText("large", { exact: true })).toHaveCount(1);
});

test("following a foreign key filters the target table", async ({ page }) => {
  await connectSqlite(page, `CREATE TABLE owners (id INTEGER PRIMARY KEY, who TEXT);
    CREATE TABLE dogs (id INTEGER PRIMARY KEY, owner_id INTEGER REFERENCES owners (id), dog TEXT);
    INSERT INTO owners (who) VALUES ('Ann'), ('Ben');
    INSERT INTO dogs (owner_id, dog) VALUES (2, 'Fido')`);
  await page.getByRole("button", { name: "Explorer" }).click();
  await page.getByRole("button", { name: /dogs/ }).click();
  await page.getByText("Fido", { exact: true }).hover();
  await page.getByTitle("Go to related row").click();
  await expect(page.getByText("id = 2")).toBeVisible();
  await expect(page.getByText("Ben", { exact: true })).toBeVisible();
  await expect(page.getByText("Ann", { exact: true })).toBeHidden();
});

test("pages forward by cursor and back, and a reload falls back to the offset", async ({ page }) => {
  await connectSqlite(page, `CREATE TABLE big (id INTEGER PRIMARY KEY, label TEXT NOT NULL);
    WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 60)
    INSERT INTO big (label) SELECT 'row ' || i FROM n`);
  await page.getByRole("button", { name: "Explorer" }).click();
  await page.getByRole("button", { name: /big/ }).click();
  await expect(page.getByText("1–50 of 60")).toBeVisible();
  await expect(page.getByText("row 1", { exact: true })).toBeVisible();

  const next = page.waitForRequest((r) => r.url().includes("/api/rows/big?"));
  await page.getByRole("button", { name: "Next page" }).click();
  expect(new URL((await next).url()).searchParams.get("after")).toBe('["50"]');
  await expect(page.getByText("row 51", { exact: true })).toBeVisible();
  await expect(page.getByText("51–60 of 60")).toBeVisible();
  await expect(page.getByRole("button", { name: "Next page" })).toBeDisabled();

  const reloaded = page.waitForRequest((r) => r.url().includes("/api/rows/big?"));
  await page.reload();
  expect(new URL((await reloaded).url()).searchParams.get("after")).toBeNull();
  await expect(page.getByText("row 51", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Previous page" }).click();
  await expect(page.getByText("row 1", { exact: true })).toBeVisible();
  await expect(page.getByText("1–50 of 60")).toBeVisible();
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
