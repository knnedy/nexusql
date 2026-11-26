import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import type { SearchItem } from "../lib/search";
import { SearchPanel } from "./search-panel";

const ITEMS: SearchItem[] = [
  { id: "table:customers", kind: "table", label: "customers" },
  { id: "table:orders", kind: "table", label: "orders" },
  { id: "column:orders.customer_id", kind: "column", label: "customer_id", detail: "orders" },
  { id: "action:sql", kind: "action", label: "Toggle SQL", detail: "Ctrl J" },
];

function renderPanel() {
  const onRun = vi.fn();
  const onOpenChange = vi.fn();
  render(<SearchPanel open onOpenChange={onOpenChange} items={ITEMS} onRun={onRun} />);
  return { onRun, onOpenChange };
}

it("narrows as you type, grouped by kind, and Enter runs the best match", async () => {
  const { onRun, onOpenChange } = renderPanel();
  const box = screen.getByRole("combobox", { name: "Search" });
  expect(box).toHaveFocus();
  await userEvent.type(box, "customer");
  expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
    expect.stringContaining("customers"),
    expect.stringContaining("customer_id"),
  ]);
  expect(screen.getByRole("group", { name: "Columns" })).toHaveTextContent("orders");
  await userEvent.keyboard("{Enter}");
  expect(onRun).toHaveBeenCalledWith(ITEMS[0]);
  expect(onOpenChange).toHaveBeenCalledWith(false);
});

it("moves with the arrow keys, wrapping, and marks the active option", async () => {
  const { onRun } = renderPanel();
  const box = screen.getByRole("combobox", { name: "Search" });
  await userEvent.keyboard("{ArrowUp}");
  const active = screen.getByRole("option", { selected: true });
  expect(active).toHaveTextContent("Toggle SQL");
  expect(box).toHaveAttribute("aria-activedescendant", active.id);
  await userEvent.keyboard("{ArrowDown}{ArrowDown}{Enter}");
  expect(onRun).toHaveBeenCalledWith(ITEMS[1]);
});

it("says so when nothing matches", async () => {
  renderPanel();
  await userEvent.type(screen.getByRole("combobox", { name: "Search" }), "zzz");
  expect(screen.queryAllByRole("option")).toHaveLength(0);
  expect(screen.getByText(/Nothing matches/)).toBeInTheDocument();
});
