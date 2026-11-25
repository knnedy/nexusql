import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FilterChip } from "./chip";

describe("FilterChip", () => {
  it("removes through a button named after the filter", async () => {
    const onRemove = vi.fn();
    render(<FilterChip removeLabel="Remove filter status is paid" onRemove={onRemove}>status is paid</FilterChip>);
    await userEvent.click(screen.getByRole("button", { name: "Remove filter status is paid" }));
    expect(onRemove).toHaveBeenCalledOnce();
  });
});
