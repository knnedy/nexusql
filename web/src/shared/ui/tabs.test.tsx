import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Tabs } from "./tabs";

const ITEMS = [
  { id: "diagram", label: "Diagram" },
  { id: "data", label: "Data" },
  { id: "export", label: "Export" },
];

function Harness() {
  const [view, setView] = useState("data");
  return <Tabs label="View" items={ITEMS} value={view} onChange={setView} />;
}

describe("Tabs", () => {
  it("marks only the chosen tab as selected and focusable", () => {
    render(<Harness />);
    const data = screen.getByRole("tab", { name: "Data" });
    expect(data).toHaveAttribute("aria-selected", "true");
    expect(data).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("tab", { name: "Diagram" })).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("tablist", { name: "View" })).toBeInTheDocument();
  });

  it("moves with the arrow keys, wrapping, and jumps with Home and End", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("tab", { name: "Data" }));
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Export" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "Export" })).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Diagram" })).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Export" })).toHaveFocus();
    await user.keyboard("{Home}{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "Export" })).toHaveAttribute("aria-selected", "true");
  });

  it("points each tab at the panel it controls", () => {
    render(<Harness />);
    const tab = screen.getByRole("tab", { name: "Data" });
    expect(tab.getAttribute("aria-controls")).toMatch(/panel-data$/);
  });
});
