import { expect, test } from "@playwright/test";
import { connectSqlite } from "./helpers";

test("lists the server's export formats and renders the chosen one", async ({ page }) => {
  await connectSqlite(page, "CREATE TABLE pets (id INTEGER PRIMARY KEY, name TEXT NOT NULL)");
  await page.getByRole("button", { name: "Open sidebar" }).click();
  await expect(page.getByRole("button", { name: /Prisma schema/ })).toBeVisible();
  await page.getByRole("button", { name: /Drizzle schema/ }).click();
  await expect(page.getByText(/sqliteTable\('pets'/)).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download export" }).click();
  expect((await download).suggestedFilename()).toBe("schema.ts");
});
