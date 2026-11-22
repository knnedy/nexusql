import { QueryClient } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { PNG_EXPORT } from "@/shared/hooks/use-export";
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
