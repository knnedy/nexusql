import { describe, expect, it } from "vitest";
import { shortcutFor } from "./shortcuts";

const key = (k: string, mods: Partial<Record<"ctrlKey" | "metaKey" | "shiftKey" | "altKey", boolean>> = {}, target: EventTarget | null = document.body) =>
  ({ key: k, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, target, ...mods }) as KeyboardEvent;

describe("shortcutFor", () => {
  it("maps Ctrl or Cmd with K, B and J to search, sidebar and SQL", () => {
    expect(shortcutFor(key("k", { ctrlKey: true }))).toBe("search");
    expect(shortcutFor(key("K", { metaKey: true }))).toBe("search");
    expect(shortcutFor(key("b", { ctrlKey: true }))).toBe("sidebar");
    expect(shortcutFor(key("j", { ctrlKey: true }))).toBe("sql");
    expect(shortcutFor(key("k", { ctrlKey: true, shiftKey: true }))).toBeNull();
    expect(shortcutFor(key("k"))).toBeNull();
  });

  it("takes / to the table filter, unless the user is typing", () => {
    expect(shortcutFor(key("/"))).toBe("filter");
    const input = document.createElement("input");
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    expect(shortcutFor(key("/", {}, input))).toBeNull();
    expect(shortcutFor(key("/", {}, document.createElement("textarea")))).toBeNull();
    expect(shortcutFor(key("/", {}, editable))).toBeNull();
  });
});
