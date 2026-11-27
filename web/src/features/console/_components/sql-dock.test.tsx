import { QueryClient } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { api } from "@/shared/api/client";
import { openProject, withClient } from "@/test/connection-cache";
import type { QueryResponse } from "@/shared/types/query";
import { TooltipProvider } from "@/shared/ui/tooltip";
import { SqlDock } from "./sql-dock";

const base: QueryResponse = {
  columns: [], columnTypes: [], rows: [], rowsAffected: 0, isWrite: false,
  truncated: false, statements: 1, requiresConfirmation: false,
};
const pets: QueryResponse = { ...base, columns: ["name"], rows: [{ name: "Rex" }, { name: "Tom" }] };

function Harness({ startOpen = true }: { startOpen?: boolean }) {
  const [open, setOpen] = useState(startOpen);
  return <SqlDock open={open} onOpenChange={setOpen} tables={["pets", "owners"]} />;
}

function renderDock(startOpen = true) {
  const Wrapper = withClient(new QueryClient());
  return render(
    <Wrapper>
      <TooltipProvider>
        <Harness startOpen={startOpen} />
      </TooltipProvider>
    </Wrapper>,
  );
}

const editor = () => screen.getByPlaceholderText("SELECT * FROM users LIMIT 10;");

async function run(sql: string) {
  await userEvent.click(editor());
  await userEvent.paste(sql);
  await userEvent.keyboard("{Control>}{Enter}{/Control}");
}

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  openProject("shop");
});

it("runs on Ctrl+Enter and shows the rows with their count", async () => {
  const query = vi.spyOn(api, "query").mockResolvedValue(pets);
  renderDock();
  await run("SELECT name FROM pets");
  expect(query).toHaveBeenCalledWith({ sql: "SELECT name FROM pets", confirmed: false });
  expect(await screen.findByRole("cell", { name: "Rex" })).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent(/2 rows/);
});

it("asks before a write and sends the confirmation when told to run it", async () => {
  const query = vi
    .spyOn(api, "query")
    .mockResolvedValueOnce({ ...base, isWrite: true, requiresConfirmation: true })
    .mockResolvedValueOnce({ ...base, isWrite: true, rowsAffected: 3 });
  renderDock();
  await run("DELETE FROM pets");
  await userEvent.click(await screen.findByRole("button", { name: "Confirm & Run" }));
  expect(query).toHaveBeenLastCalledWith({ sql: "DELETE FROM pets", confirmed: true });
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("3 rows affected"));
});

it("keeps the SQL when collapsed and sums up the last run in the bar", async () => {
  vi.spyOn(api, "query").mockResolvedValue(pets);
  renderDock();
  await run("SELECT name FROM pets");
  await screen.findByRole("cell", { name: "Rex" });
  await userEvent.click(screen.getByRole("button", { name: "Collapse SQL" }));
  expect(screen.queryByPlaceholderText("SELECT * FROM users LIMIT 10;")).toBeNull();
  expect(screen.getByRole("region", { name: "SQL" })).toHaveTextContent(/2 rows/);
  await userEvent.click(screen.getByRole("button", { name: "Expand SQL" }));
  expect(editor()).toHaveValue("SELECT name FROM pets");
});

it("puts a query from History back in the editor", async () => {
  vi.spyOn(api, "query").mockResolvedValue(pets);
  renderDock();
  await run("SELECT name FROM pets");
  await screen.findByRole("cell", { name: "Rex" });
  await userEvent.clear(editor());
  await userEvent.click(screen.getByRole("button", { name: /History/ }));
  await userEvent.click(await screen.findByRole("menuitem", { name: /SELECT name FROM pets/ }));
  await waitFor(() => expect(editor()).toHaveValue("SELECT name FROM pets"));
});

it("runs only the selected statement and says which lines it was", async () => {
  const query = vi.spyOn(api, "query").mockResolvedValue(pets);
  renderDock();
  await userEvent.click(editor());
  await userEvent.paste("SELECT 1;\nSELECT name FROM pets;");
  const box = editor() as HTMLTextAreaElement;
  box.setSelectionRange(10, box.value.length);
  box.dispatchEvent(new Event("select", { bubbles: true }));
  expect(await screen.findByRole("button", { name: /Run selection/ })).toBeInTheDocument();
  await userEvent.keyboard("{Control>}{Enter}{/Control}");
  expect(query).toHaveBeenCalledWith({ sql: "SELECT name FROM pets;", confirmed: false });
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("selection, line 2"));
});

it("names each result column's type", async () => {
  vi.spyOn(api, "query").mockResolvedValue({ ...pets, columns: ["name", "age"], columnTypes: ["text", "int4"], rows: [{ name: "Rex", age: 3 }] });
  renderDock();
  await run("SELECT name, age FROM pets");
  expect(await screen.findByRole("columnheader", { name: /age\s*int4/ })).toBeInTheDocument();
});

it("offers the table a misspelt name meant, and fixes the SQL", async () => {
  vi.spyOn(api, "query").mockRejectedValue(new Error("no such table: pet"));
  renderDock();
  await run("SELECT name\nFROM pet");
  expect(await screen.findByText(/Line 2/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "pets" }));
  expect(editor()).toHaveValue("SELECT name\nFROM pets");
});

it("remembers the project's history after the dock is rebuilt", async () => {
  vi.spyOn(api, "query").mockResolvedValue(pets);
  const first = renderDock();
  await run("SELECT name FROM pets");
  await screen.findByRole("cell", { name: "Rex" });
  first.unmount();
  renderDock();
  await userEvent.click(screen.getByRole("button", { name: /History/ }));
  expect(await screen.findByRole("menuitem", { name: /SELECT name FROM pets/ })).toBeInTheDocument();
});

it("resizes from the keyboard on its top edge", async () => {
  renderDock();
  const edge = screen.getByRole("separator", { name: "Resize SQL" });
  const before = Number(edge.getAttribute("aria-valuenow"));
  edge.focus();
  await userEvent.keyboard("{ArrowUp}");
  expect(Number(edge.getAttribute("aria-valuenow"))).toBeGreaterThan(before);
});
