import { describe, expect, it } from "vitest";
import { cardFocus } from "./focus-store";

describe("card focus", () => {
  const near = { orders: ["customers", "items"], customers: ["orders"], items: ["orders"], tags: [] };

  it("marks the chosen table, lights what it links to and fades the rest", () => {
    expect(["orders", "customers", "items", "tags"].map((t) => cardFocus(t, "orders", near))).toEqual(["selected", "linked", "linked", "faded"]);
  });

  it("leaves every card alone when nothing is chosen", () => {
    expect(cardFocus("tags", null, near)).toBe("none");
  });
});
