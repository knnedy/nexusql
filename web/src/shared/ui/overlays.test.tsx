import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./button";
import { Dialog, DialogContent } from "./dialog";
import { Menu, MenuContent, MenuItem } from "./menu";
import { Select } from "./select";
import { ToastProvider, useToast } from "./toast";

describe("Menu", () => {
  it("opens from its trigger and runs the chosen item", async () => {
    const onCopy = vi.fn();
    const user = userEvent.setup();
    render(
      <Menu.Root>
        <Menu.Trigger render={<Button />}>Actions</Menu.Trigger>
        <MenuContent><MenuItem onClick={onCopy}>Copy DDL</MenuItem></MenuContent>
      </Menu.Root>,
    );
    await user.click(screen.getByRole("button", { name: "Actions" }));
    await user.click(await screen.findByRole("menuitem", { name: "Copy DDL" }));
    expect(onCopy).toHaveBeenCalledOnce();
  });
});

describe("Select", () => {
  it("shows the chosen option and reports a new one", async () => {
    const user = userEvent.setup();
    function Harness() {
      const [v, setV] = useState("50");
      return <Select aria-label="Rows per page" value={v} onValueChange={setV} items={[{ value: "50", label: "50" }, { value: "100", label: "100" }]} />;
    }
    render(<Harness />);
    const trigger = screen.getByRole("combobox", { name: "Rows per page" });
    expect(trigger).toHaveTextContent("50");
    await user.click(trigger);
    await user.click(await screen.findByRole("option", { name: "100" }));
    await waitFor(() => expect(trigger).toHaveTextContent("100"));
  });
});

describe("Dialog", () => {
  it("is named by its title and closes from its close button", async () => {
    const user = userEvent.setup();
    render(
      <Dialog.Root>
        <Dialog.Trigger render={<Button />}>Delete</Dialog.Trigger>
        <DialogContent title="Delete 3 rows?" description="This cannot be undone.">body</DialogContent>
      </Dialog.Root>,
    );
    await user.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("dialog", { name: "Delete 3 rows?" });
    expect(dialog).toHaveAccessibleDescription("This cannot be undone.");
    await user.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});

describe("Toast", () => {
  it("announces what happened", async () => {
    function Fire() {
      const toast = useToast();
      return <Button onClick={() => toast({ title: "Copied schema.prisma" })}>Copy</Button>;
    }
    render(<ToastProvider><Fire /></ToastProvider>);
    await userEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(await screen.findByText("Copied schema.prisma")).toBeInTheDocument();
  });
});
