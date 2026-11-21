import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { exportToCsv } from "./csv";

// Captures the file exportToCsv hands to the browser.
let downloaded: { name: string; blob: Blob } | null;

beforeEach(() => {
  downloaded = null;
  let blob: Blob | null = null;
  URL.createObjectURL = vi.fn((b: Blob) => {
    blob = b;
    return "blob:test";
  });
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    downloaded = { name: this.download, blob: blob! };
  });
});
afterEach(() => vi.restoreAllMocks());

async function csvOf(
  columns: string[],
  rows: Record<string, unknown>[],
  visibility: Record<string, boolean> = {},
) {
  exportToCsv("users", columns, rows, visibility);
  return downloaded!.blob.text();
}

describe("exportToCsv", () => {
  it("downloads <table>.csv with a header row", async () => {
    const text = await csvOf(["id", "email"], [{ id: 1, email: "a@x.io" }]);

    expect(downloaded!.name).toBe("users.csv");
    expect(text).toBe("id,email\n1,a@x.io");
  });

  it("quotes cells containing commas, quotes or newlines", async () => {
    const text = await csvOf(["v"], [{ v: "a,b" }, { v: 'say "hi"' }, { v: "two\nlines" }]);

    expect(text).toBe('v\n"a,b"\n"say ""hi"""\n"two\nlines"');
  });

  it("writes NULL as an empty cell and objects as JSON", async () => {
    const text = await csvOf(["a", "b"], [{ a: null, b: { k: 1 } }]);

    expect(text).toBe('a,b\n,"{""k"":1}"');
  });

  it("leaves out hidden columns", async () => {
    const text = await csvOf(["id", "secret"], [{ id: 1, secret: "x" }], { secret: false });

    expect(text).toBe("id\n1");
  });
});
