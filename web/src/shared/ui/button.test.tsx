import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button, IconButton } from "./button";

describe("Button", () => {
  it("never submits a form unless asked to", () => {
    render(<form><Button>Run</Button><Button type="submit">Save</Button></form>);
    expect(screen.getByRole("button", { name: "Run" })).toHaveAttribute("type", "button");
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("type", "submit");
  });

  it("gives an icon-only button its label as its name", () => {
    render(<IconButton label="Collapse sidebar"><svg /></IconButton>);
    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toBeInTheDocument();
  });
});
