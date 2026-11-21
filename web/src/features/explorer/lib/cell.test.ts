import { describe, expect, it } from "vitest";
import { cellText, isUnchanged } from "./cell";

describe("cellText", () => {
  it("keeps NULL apart from the empty string", () => {
    expect(cellText(null)).toBeNull();
    expect(cellText(undefined)).toBeNull();
    expect(cellText("")).toBe("");
  });
  it("shows JSON values as compact JSON", () => {
    expect(cellText({ a: [1, "x"] })).toBe('{"a":[1,"x"]}');
  });
  it("shows scalars as text", () => {
    expect(cellText(42)).toBe("42");
    expect(cellText("9007199254740993")).toBe("9007199254740993");
    expect(cellText(false)).toBe("false");
  });
});

describe("isUnchanged", () => {
  it("compares against the text the cell showed", () => {
    expect(isUnchanged({ a: 1 }, '{"a":1}')).toBe(true);
    expect(isUnchanged(5, "5")).toBe(true);
    expect(isUnchanged(5, "6")).toBe(false);
  });
  it("treats NULL and the empty string as different values", () => {
    expect(isUnchanged(null, null)).toBe(true);
    expect(isUnchanged(null, "")).toBe(false);
    expect(isUnchanged("", null)).toBe(false);
  });
});
