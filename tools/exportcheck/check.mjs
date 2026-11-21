// Validates every export golden under internal/db/*/testdata with the real
// tools: prisma validate for export.prisma, tsc against drizzle-orm for export.ts.
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

const here = import.meta.dirname;
const root = resolve(here, "../..");
const dialects = readdirSync(join(root, "internal/db")).filter((d) =>
  existsSync(join(root, "internal/db", d, "testdata")),
);
const bin = (name) => join(here, "node_modules/.bin", name);
const env = { ...process.env, NO_COLOR: "1" };

let failed = 0;
const run = (label, cmd, args) => {
  try {
    execFileSync(cmd, args, { stdio: "pipe", env, cwd: here });
    console.log(`ok    ${label}`);
  } catch (err) {
    failed++;
    console.log(`FAIL  ${label}\n${err.stdout}${err.stderr}`);
  }
};

const out = join(here, "out");
rmSync(out, { recursive: true, force: true });
mkdirSync(out);
let checked = 0;
for (const d of dialects) {
  const prisma = join(root, "internal/db", d, "testdata/export.prisma");
  if (existsSync(prisma)) {
    run(`${d}/export.prisma`, bin("prisma"), ["validate", "--schema", prisma]);
    checked++;
  }
  const drizzle = join(root, "internal/db", d, "testdata/export.ts");
  if (existsSync(drizzle)) {
    copyFileSync(drizzle, join(out, `${d}.ts`));
    checked++;
  }
}
// The copies sit next to node_modules so drizzle-orm resolves.
run("export.ts (tsc)", bin("tsc"), ["-p", "tsconfig.json"]);
if (checked === 0) throw new Error("no export golden files found");
process.exit(failed ? 1 : 0);
