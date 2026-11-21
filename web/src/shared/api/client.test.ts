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
