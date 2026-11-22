import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormatIcon, formatTint } from "./format-icon";

// Every format internal/export/formats.go lists.
const SERVER_FORMATS = ["sql", "prisma", "drizzle", "kysely", "sqlalchemy", "gorm", "typeorm", "dbml", "mermaid"];

describe("FormatIcon", () => {
  it.each(SERVER_FORMATS)("%s has its own brand mark", (id) => {
    const { container } = render(<FormatIcon id={id} provider="postgres" />);
    expect(container.querySelector("svg")).not.toBeNull();
    expect(container.querySelector("[data-fallback]")).toBeNull();
    expect(formatTint(id, "postgres")).not.toBe(formatTint("unknown", "postgres"));
  });

  it("marks SQL with the connected database", () => {
    const pg = render(<FormatIcon id="sql" provider="postgres" />).container.innerHTML;
    const lite = render(<FormatIcon id="sql" provider="sqlite" />).container.innerHTML;
    const my = render(<FormatIcon id="sql" provider="mysql" />).container.innerHTML;
    expect(new Set([pg, lite, my]).size).toBe(3);
  });

  it("falls back for a format it does not know", () => {
    const { container } = render(<FormatIcon id="unknown" provider="postgres" />);
    expect(container.querySelector("[data-fallback]")).not.toBeNull();
  });
});
