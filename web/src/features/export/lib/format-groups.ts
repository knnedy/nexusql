import type { ExportFormat } from "@/shared/types/health";

const GROUPS: { label: string; ids: string[] }[] = [
  { label: "Diagrams", ids: ["dbml", "mermaid"] },
  { label: "SQL", ids: ["sql"] },
  { label: "ORMs and types", ids: ["prisma", "drizzle", "kysely", "sqlalchemy", "gorm", "typeorm", "sequelize"] },
];

export interface FormatGroup {
  label: string;
  formats: ExportFormat[];
}

/** Sorts the server's formats into fixed groups; unknown ids land in Other. */
export function groupFormats(formats: ExportFormat[]): FormatGroup[] {
  const known = new Set(GROUPS.flatMap((g) => g.ids));
  const groups = GROUPS.map((g) => ({ label: g.label, formats: formats.filter((f) => g.ids.includes(f.id)) }));
  groups.push({ label: "Other", formats: formats.filter((f) => !known.has(f.id)) });
  return groups.filter((g) => g.formats.length > 0);
}
