// Validates every export golden under internal/db/*/testdata with the real
// tools: prisma validate for export.prisma, tsc against drizzle-orm for export.ts,
// the @dbml/core parser for export.dbml.
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { Parser } from "@dbml/core";
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
  const dbml = join(root, "internal/db", d, "testdata/export.dbml");
  if (existsSync(dbml)) {
    checked++;
    try {
      const schema = Parser.parse(readFileSync(dbml, "utf8"), "dbmlv2").schemas[0];
      if (!schema.tables.length || !schema.refs.length) throw new Error("no tables or refs parsed");
      console.log(`ok    ${d}/export.dbml (${schema.tables.length} tables, ${schema.refs.length} refs)`);
    } catch (err) {
      failed++;
      const diags = err.diags?.map((x) => `  ${x.location?.start?.line}: ${x.message}`).join("\n");
      console.log(`FAIL  ${d}/export.dbml\n${diags ?? err.message}`);
    }
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
