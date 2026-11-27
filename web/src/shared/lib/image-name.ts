/** What an export covers: every table, the chosen one, or it and the tables it links to. */
export type Include = "all" | "table" | "linked";

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** A diagram PNG's file name: the project first, then the table it centres on, if any. */
export function imageName(project: string | null, include: Include, table: string | null): string {
  const what = !table || include === "all" ? "diagram" : include === "table" ? slug(table) : `${slug(table)}-and-linked`;
  return `${[slug(project ?? ""), what].filter(Boolean).join("-")}.png`;
}
