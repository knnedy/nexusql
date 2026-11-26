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
  columns: [], rows: [], rowsAffected: 0, isWrite: false,
  truncated: false, statements: 1, requiresConfirmation: false,
};
const pets: QueryResponse = { ...base, columns: ["name"], rows: [{ name: "Rex" }, { name: "Tom" }] };

function Harness({ startOpen = true }: { startOpen?: boolean }) {
  const [open, setOpen] = useState(startOpen);
  return <SqlDock open={open} onOpenChange={setOpen} />;
}

function renderDock(startOpen = true) {
  const Wrapper = withClient(new QueryClient());
  render(
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
  openProject("shop");
});

it("runs on Ctrl+Enter and shows the rows with their count", async () => {
  const query = vi.spyOn(api, "query").mockResolvedValue(pets);
  renderDock();
  await run("SELECT name FROM pets");
  expect(query).toHaveBeenCalledWith({ sql: "SELECT name FROM pets", confirmed: false });
  expect(await screen.findByRole("cell", { name: "Rex" })).toBeInTheDocument();
  expect(screen.getByText(/2 rows/)).toBeInTheDocument();
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
