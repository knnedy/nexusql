// Runs prisma validate on every export golden file under internal/db/*/testdata.
import { execFileSync } from "node:child_process";
import { readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const dialects = join(root, "internal/db");
const prisma = join(import.meta.dirname, "node_modules/.bin/prisma");

const files = readdirSync(dialects)
  .map((d) => join(dialects, d, "testdata", "export.prisma"))
  .filter((f) => existsSync(f));
if (files.length === 0) throw new Error("no export golden files found");

let failed = 0;
for (const file of files) {
  try {
    execFileSync(prisma, ["validate", "--schema", file], {
      stdio: "pipe",
      env: { ...process.env, NO_COLOR: "1" },
    });
    console.log(`ok    ${file.slice(root.length + 1)}`);
  } catch (err) {
    failed++;
    console.log(`FAIL  ${file.slice(root.length + 1)}\n${err.stdout}${err.stderr}`);
  }
}
process.exit(failed ? 1 : 0);
