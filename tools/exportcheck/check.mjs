// Validates every export golden under internal/db/*/testdata with the real
// tools: prisma validate for export.prisma, tsc against drizzle-orm and kysely
// for export.ts and export.kysely.ts,
// the @dbml/core parser for export.dbml, mermaid's parser for export.mmd, and
// TypeORM's metadata validation (plus a sql.js sync on SQLite) for export.typeorm.ts.
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { Parser } from "@dbml/core";
import "reflect-metadata";
import { DataSource } from "typeorm";
import mermaid from "mermaid";
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
mkdirSync(join(out, "typeorm"), { recursive: true });
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
  const mmd = join(root, "internal/db", d, "testdata/export.mmd");
  if (existsSync(mmd)) {
    checked++;
    try {
      const res = await mermaid.parse(readFileSync(mmd, "utf8"));
      if (res.diagramType !== "er") throw new Error(`parsed as ${res.diagramType}`);
      console.log(`ok    ${d}/export.mmd`);
    } catch (err) {
      failed++;
      console.log(`FAIL  ${d}/export.mmd\n${err.message ?? err}`);
    }
  }
  const drizzle = join(root, "internal/db", d, "testdata/export.ts");
  if (existsSync(drizzle)) {
    copyFileSync(drizzle, join(out, `${d}.ts`));
    checked++;
  }
  const typeorm = join(root, "internal/db", d, "testdata/export.typeorm.ts");
  if (existsSync(typeorm)) {
    copyFileSync(typeorm, join(out, "typeorm", `${d}.ts`));
    checked++;
  }
  const kysely = join(root, "internal/db", d, "testdata/export.kysely.ts");
  if (existsSync(kysely)) {
    copyFileSync(kysely, join(out, `${d}.kysely.ts`));
    checked++;
  }
}
// The copies sit next to node_modules so drizzle-orm resolves.
run("export.ts, export.kysely.ts (tsc)", bin("tsc"), ["-p", "tsconfig.json"]);
run("export.typeorm.ts (tsc, decorators)", bin("tsc"), ["-p", "tsconfig.typeorm.json"]);

// Builds and validates the entity metadata on each dialect's driver without
// connecting; SQLite also creates the schema in sql.js.
const drivers = { postgres: "postgres", mysql: "mysql", sqlite: "sqljs" };
for (const d of dialects) {
  const js = join(out, "typeorm/js", `${d}.js`);
  if (!existsSync(js)) continue;
  const entities = Object.values(await import(js)).filter((v) => typeof v === "function");
  // mysql wants a database name even though nothing connects.
  const ds = new DataSource({ type: drivers[d], entities, synchronize: d === "sqlite", ...(d === "mysql" && { database: "check" }) });
  try {
    if (d === "sqlite") await ds.initialize();
    else await ds.buildMetadatas();
    const relations = ds.entityMetadatas.reduce((n, e) => n + e.foreignKeys.length, 0);
    console.log(`ok    ${d}/export.typeorm.ts (${ds.entityMetadatas.length} entities, ${relations} foreign keys)`);
  } catch (err) {
    failed++;
    console.log(`FAIL  ${d}/export.typeorm.ts\n${err.message}`);
  } finally {
    if (ds.isInitialized) await ds.destroy();
  }
}
if (checked === 0) throw new Error("no export golden files found");
process.exit(failed ? 1 : 0);
