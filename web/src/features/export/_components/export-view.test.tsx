import { QueryClient } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { exportFormatsQueryOptions, exportQueryOptions } from "@/shared/hooks/use-export";
import { withClient } from "@/test/connection-cache";
import { ToastProvider } from "@/shared/ui/toast";
import { ExportView } from "./export-view";

vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "dark" }) }));

const FORMATS = [
  { id: "sql", label: "SQL DDL", description: "CREATE statements", language: "sql", filename: "schema.sql" },
  { id: "mermaid", label: "Mermaid ER diagram", description: "erDiagram", language: "mermaid", filename: "schema.mmd" },
  { id: "dbml", label: "DBML", description: "dbdiagram.io", language: "text", filename: "schema.dbml" },
];

function renderExport(format: string, schema: string, onFormatChange = () => {}) {
  const client = new QueryClient();
  client.setQueryData(exportFormatsQueryOptions().queryKey, FORMATS);
  client.setQueryData(exportQueryOptions(format, true).queryKey, { format, schema });
  const Wrapper = withClient(client);
  render(
    <Wrapper>
      <ToastProvider>
        <ExportView format={format} onFormatChange={onFormatChange} />
      </ToastProvider>
    </Wrapper>,
  );
}

it("lists the formats in groups and reports the chosen one", async () => {
  const onFormatChange = vi.fn();
  renderExport("sql", "CREATE TABLE pets ();", onFormatChange);
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
