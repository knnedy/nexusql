import { describe, expect, it } from "vitest";
import type { ExportFormat } from "@/shared/types/health";
import { groupFormats } from "./format-groups";

const f = (id: string): ExportFormat => ({ id, label: id, description: "", language: "text", filename: `x.${id}` });

describe("groupFormats", () => {
  it("groups the server's formats in a fixed order and keeps the server's order inside a group", () => {
    const groups = groupFormats(["sql", "prisma", "drizzle", "dbml", "mermaid", "gorm"].map(f));
    expect(groups.map((g) => [g.label, g.formats.map((x) => x.id)])).toEqual([
      ["Diagrams", ["dbml", "mermaid"]],
      ["SQL", ["sql"]],
      ["ORMs and types", ["prisma", "drizzle", "gorm"]],
    ]);
  });

  it("puts a format it does not know under Other and drops empty groups", () => {
    expect(groupFormats([f("sql"), f("liquibase")]).map((g) => g.label)).toEqual(["SQL", "Other"]);
  });
});
