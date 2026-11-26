import { expect, test } from "@playwright/test";
import { connectSqlite } from "./helpers";

test("a project can be renamed, opened at its data, and deleted after confirming", async ({ page }) => {
  await connectSqlite(page, "CREATE TABLE pets (id INTEGER PRIMARY KEY)");
  await page.goto("/projects");
  const list = page.getByRole("list", { name: "Projects" });
  const row = list.getByRole("listitem").first(); // the one just connected: newest
  const name = (await row.getByRole("button").first().innerText()).split("\n")[0];

  await row.hover();
  await row.getByRole("button", { name: `More for ${name}` }).click();
  await page.getByRole("menuitem", { name: "Rename" }).click();
  await row.getByRole("textbox", { name: "Project name" }).fill(`${name} renamed`);
  await page.keyboard.press("Enter");
  await expect(list).toContainText(`${name} renamed`);

  await row.hover();
  await row.getByRole("button", { name: "Data" }).click();
  await expect(page).toHaveURL(/view=data/);

  await page.goto("/projects");
  await list.getByRole("listitem").first().hover();
  await page.getByRole("button", { name: `More for ${name} renamed` }).click();
  await page.getByRole("menuitem", { name: "Delete…" }).click();
  await expect(page.getByRole("dialog")).toContainText("The database and its data are not touched.");
  await page.getByRole("button", { name: "Delete project" }).click();
  await expect(list.getByText(`${name} renamed`)).toHaveCount(0);
});
