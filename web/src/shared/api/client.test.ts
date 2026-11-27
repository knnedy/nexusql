import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./client";

function respond(status: number, body: string) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(body, { status })));
}

afterEach(() => vi.unstubAllGlobals());

describe("API errors", () => {
  it("carry the server's message, not its JSON envelope", async () => {
    respond(409, '{"error":"the connection is read-only"}\n');
    await expect(api.health()).rejects.toThrow(/^the connection is read-only$/);
  });
  it("fall back to the body, then the status", async () => {
    respond(502, "upstream down");
    await expect(api.health()).rejects.toThrow(/^upstream down$/);
    respond(500, "");
    await expect(api.health()).rejects.toThrow("Request failed with status 500");
  });
});

it("asks for an export of chosen tables by repeating tables=", async () => {
  respond(200, '{"format":"sql","schema":""}');
  await api.export.render("sql", ["pets", "own ers"]);
  await api.export.render("sql");
  const urls = vi.mocked(fetch).mock.calls.map(([url]) => String(url));
  expect(urls[0]).toMatch(/\/api\/export\/sql\?tables=pets&tables=own\+ers$/);
  expect(urls[1]).toMatch(/\/api\/export\/sql$/);
});
