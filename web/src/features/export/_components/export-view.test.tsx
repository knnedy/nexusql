import { QueryClient } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { exportFormatsQueryOptions, exportQueryOptions } from "@/shared/hooks/use-export";
import { withClient } from "@/test/connection-cache";
import { ToastProvider } from "@/shared/ui/toast";
import type { SchemaResponse } from "@/shared/types/schema";
import type { Include } from "../lib/scope";
import { ExportView } from "./export-view";

vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "dark" }) }));
const useDiagramImage = vi.fn((...args: unknown[]) => {
  void args;
  return { png: { url: "data:image/png;base64,AAAA", width: 3840, height: 2400 }, failed: false, empty: false, pending: false, stage: null };
});
vi.mock("@/features/canvas", () => ({ useDiagramImage: (...args: unknown[]) => useDiagramImage(...args) }));

const FORMATS = [
  { id: "sql", label: "SQL DDL", description: "CREATE statements", language: "sql", filename: "schema.sql" },
  { id: "mermaid", label: "Mermaid ER diagram", description: "erDiagram", language: "mermaid", filename: "schema.mmd" },
  { id: "dbml", label: "DBML", description: "dbdiagram.io", language: "text", filename: "schema.dbml" },
];

const SCHEMA = {
  tables: ["owners", "pets", "vets"].map((name) => ({ name, schema: "", fields: [] })),
  relations: [{ sourceTable: "pets", targetTable: "owners" }],
  enums: [],
} as unknown as SchemaResponse;

interface Opts {
  onFormatChange?: (id: string) => void;
  onIncludeChange?: (include: Include) => void;
  table?: string | null;
  include?: Include;
  tables?: string[];
}

function renderExport(format: string, schema: string, opts: Opts = {}) {
  const client = new QueryClient();
  client.setQueryData(exportFormatsQueryOptions().queryKey, FORMATS);
  client.setQueryData(exportQueryOptions(format, true, opts.tables).queryKey, { format, schema });
  const Wrapper = withClient(client);
  render(
    <Wrapper>
      <ToastProvider>
        <ExportView
          format={format}
          onFormatChange={opts.onFormatChange ?? (() => {})}
          schema={SCHEMA}
          table={opts.table ?? null}
          include={opts.include ?? "all"}
          onIncludeChange={opts.onIncludeChange ?? (() => {})}
        />
      </ToastProvider>
    </Wrapper>,
  );
}

it("lists the formats in groups and reports the chosen one", async () => {
  const onFormatChange = vi.fn();
  renderExport("sql", "CREATE TABLE pets ();", { onFormatChange });
  expect(screen.getByRole("group", { name: "Diagrams" })).toHaveTextContent("DBML");
  await userEvent.click(screen.getByRole("button", { name: /DBML/ }));
  expect(onFormatChange).toHaveBeenCalledWith("dbml");
});

it("names the download after the file it saves", () => {
  renderExport("sql", "CREATE TABLE pets ();");
  expect(screen.getByRole("button", { name: "Download schema.sql" })).toBeInTheDocument();
});

// Mermaid as the server writes it: entities, then one line per relationship.
function mermaid(relations: number, padding = 0) {
  const rels = Array.from({ length: relations }, (_, i) => `  t${i} ${i % 2 ? "|o..o{" : "||--o{"} u${i} : "a_id"`);
  return ["erDiagram", `  t0 {\n    text pad "${"x".repeat(padding)}"\n  }`, ...rels].join("\n");
}

const TOO_BIG = /too large for most Mermaid renderers/;

it.each([
  ["over 500 relationships", mermaid(501)],
  ["over 50,000 characters", mermaid(1, 50_000)],
])("warns that Mermaid with %s will not render", (_, schema) => {
  renderExport("mermaid", schema);
  expect(screen.getByRole("note")).toHaveTextContent(TOO_BIG);
  expect(screen.getByRole("note")).toHaveTextContent(/PNG|DBML/);
});

it("does not warn for Mermaid within the limits", () => {
  const schema = mermaid(500, 30_000);
  expect(schema.length).toBeLessThan(50_000);
  renderExport("mermaid", schema);
  expect(screen.queryByText(TOO_BIG)).toBeNull();
});

it("does not warn for a large export in another format", () => {
  renderExport("dbml", "x".repeat(60_000));
  expect(screen.queryByText(TOO_BIG)).toBeNull();
});

it("offers the whole schema only, until a table is chosen", () => {
  renderExport("sql", "CREATE TABLE pets ();\nCREATE TABLE owners ();\n");
  expect(screen.queryByRole("group", { name: "Include" })).not.toBeInTheDocument();
  expect(screen.getByText("3 tables · 2 lines")).toBeInTheDocument();
});

it("narrows the export to the chosen table, or it and its linked tables", async () => {
  const onIncludeChange = vi.fn();
  renderExport("sql", "CREATE TABLE pets ();", { table: "pets", include: "linked", tables: ["owners", "pets"], onIncludeChange });
  const include = screen.getByRole("group", { name: "Include" });
  expect(within(include).getByRole("button", { name: "pets and its 1 linked table" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByText("2 tables · 1 line")).toBeInTheDocument();
  expect(screen.getByText(/Keys to tables left out become plain columns/)).toBeInTheDocument();
  await userEvent.click(within(include).getByRole("button", { name: "pets only" }));
  expect(onIncludeChange).toHaveBeenCalledWith("table");
  await userEvent.click(within(include).getByRole("button", { name: "All 3 tables" }));
  expect(onIncludeChange).toHaveBeenCalledWith("all");
});

it("wraps long lines on request", async () => {
  renderExport("sql", "CREATE TABLE pets ();");
  const wrap = screen.getByRole("button", { name: "Wrap lines" });
  expect(wrap).toHaveAttribute("aria-pressed", "false");
  await userEvent.click(wrap);
  expect(wrap).toHaveAttribute("aria-pressed", "true");
});

describe("the diagram image", () => {
  beforeEach(() => sessionStorage.setItem("nexusql_project_name", "Quizify"));
  afterEach(() => sessionStorage.clear());

  it("leads the diagram formats", () => {
    renderExport("sql", "");
    const diagrams = screen.getByRole("group", { name: "Diagrams" });
    expect(within(diagrams).getAllByRole("button")[0]).toHaveTextContent("Diagram image");
  });

  it("previews the PNG, named after the project, and saves it", async () => {
    renderExport("png", "");
    expect(screen.getByRole("heading", { name: "quizify-diagram.png" })).toBeInTheDocument();
    expect(screen.getByText("3 tables · 3,840 × 2,400 px")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Diagram of 3 tables" })).toHaveAttribute("src", "data:image/png;base64,AAAA");
    expect(screen.getByRole("button", { name: "Download quizify-diagram.png" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Copy image" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Wrap lines" })).not.toBeInTheDocument();
  });

  it("draws the chosen tables with the options picked", async () => {
    renderExport("png", "", { table: "pets", include: "table" });
    expect(screen.getByRole("heading", { name: "quizify-pets.png" })).toBeInTheDocument();
    const [schema, , options, enabled] = useDiagramImage.mock.lastCall!;
    expect((schema as SchemaResponse).tables.map((t) => t.name)).toEqual(["pets"]);
    expect(options).toEqual({ regions: true, transparent: false });
    expect(enabled).toBe(true);
    await userEvent.click(screen.getByRole("checkbox", { name: "Transparent background" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Group regions" }));
    expect(useDiagramImage.mock.lastCall![2]).toEqual({ regions: false, transparent: true });
  });

  it("draws nothing while a code format is open", () => {
    renderExport("sql", "CREATE TABLE pets ();");
    expect(useDiagramImage.mock.lastCall![3]).toBe(false);
  });
});
