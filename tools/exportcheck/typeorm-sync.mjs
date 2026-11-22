// Compiles a TypeORM entities file and synchronizes it into the database at a
// URI: node typeorm-sync.mjs <postgres|mysql|sqlite> <uri> <entities.ts>.
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import "reflect-metadata";
import { DataSource } from "typeorm";

const [dialect, uri, src] = process.argv.slice(2);
const here = import.meta.dirname;
const dir = join(here, "out/sync", dialect);
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
copyFileSync(src, join(dir, "entities.ts"));
execFileSync(join(here, "node_modules/.bin/tsc"), [
  "--strict", "--skipLibCheck", "--experimentalDecorators", "--emitDecoratorMetadata",
  "--target", "es2022", "--module", "nodenext", "--moduleResolution", "nodenext",
  "--outDir", join(dir, "js"), join(dir, "entities.ts"),
], { stdio: "inherit", cwd: here }); // cwd: so @types/node is found

const mod = await import(pathToFileURL(join(dir, "js/entities.js")).href);
const entities = Object.values(mod).filter((v) => typeof v === "function");
const options = {
  postgres: { type: "postgres", url: uri },
  mysql: { type: "mysql", url: uri },
  sqlite: { type: "sqljs", location: uri.replace(/^sqlite:\/\//, ""), autoSave: true },
}[dialect];
const ds = new DataSource({ ...options, entities, synchronize: true });
await ds.initialize();
await ds.destroy();
