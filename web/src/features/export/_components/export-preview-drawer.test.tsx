import { QueryClient } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { exportQueryOptions, PNG_EXPORT } from "@/shared/hooks/use-export";
import { withClient } from "@/test/connection-cache";
import ExportPreviewDrawer from "./export-preview-drawer";

vi.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "dark" }) }));

// A 1x1 PNG, like the canvas snapshot: a data: URL whose size is not known up front.
const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

it("shows the canvas snapshot it was given", () => {
  const Wrapper = withClient(new QueryClient());
  render(
    <Wrapper>
      <ExportPreviewDrawer
        type={PNG_EXPORT}
        sidebarOpen
        onClose={() => {}}
        pngDataUrl={PNG}
        isGeneratingPng={false}
        onGeneratePng={() => {}}
      />
    </Wrapper>,
  );
  expect(screen.getByAltText("Canvas snapshot")).toHaveAttribute("src", PNG);
});

function renderExport(type: string, schema: string) {
  const client = new QueryClient();
  client.setQueryData(exportQueryOptions(type, true).queryKey, { format: type, schema });
  const Wrapper = withClient(client);
  render(
    <Wrapper>
      <ExportPreviewDrawer
        type={type}
        sidebarOpen
        onClose={() => {}}
        pngDataUrl={null}
        isGeneratingPng={false}
        onGeneratePng={() => {}}
      />
    </Wrapper>,
  );
}

// Mermaid as the server writes it: entities, then one line per relationship
// (identifying -- and non-identifying ..).
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
