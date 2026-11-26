import { describe, expect, it } from "vitest";
import { nextSearch, parseView, selectTableUpdates } from "./workspace-url";

describe("parseView", () => {
  it("opens the diagram unless the URL names another known view", () => {
    expect(parseView(null)).toBe("diagram");
    expect(parseView("data")).toBe("data");
    expect(parseView("export")).toBe("export");
    expect(parseView("nonsense")).toBe("diagram");
  });
});

describe("nextSearch", () => {
  it("sets, replaces and drops parameters, keeping the rest", () => {
    const now = new URLSearchParams("view=data&table=pets&page=3&sort=name");
    expect(nextSearch(now, { page: null, sort: "", dir: "desc" })).toBe("view=data&table=pets&dir=desc");
    expect(nextSearch(now, { table: "owners" })).toBe("view=data&table=owners&page=3&sort=name");
  });
});

describe("selectTableUpdates", () => {
  it("clears the previous table's paging, sorting, search and filters", () => {
    const now = new URLSearchParams("view=data&table=pets&page=3&sort=name&dir=desc&search=rex&filters=x");
    expect(nextSearch(now, selectTableUpdates("owners"))).toBe("view=data&table=owners");
  });
});
