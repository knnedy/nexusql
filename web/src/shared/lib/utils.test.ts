import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatRelativeTime, normalizeFieldType } from "./utils";

describe("normalizeFieldType", () => {
  it.each([
    ["INT", "postgres", "integer"],
    ["datetime", "mysql", "timestamp"],
    ["int8", "postgres", "bigint"],
    ["timestamp with time zone", "postgres", "timestamptz"],
    ["character varying", "postgres", "varchar"],
    ["tinyint(1)", "mysql", "boolean"],
    ["longtext", "mysql", "text"],
    ["VARCHAR(255)", "sqlite", "varchar(255)"],
    ["INTEGER", "sqlite", "integer"],
    ["REAL", "sqlite", "double precision"],
  ] as const)("maps %s on %s to %s", (raw, provider, want) => {
    expect(normalizeFieldType(raw, provider)).toBe(want);
  });

  it("keeps dialect-specific names to their own dialect", () => {
    expect(normalizeFieldType("int8", "mysql")).toBe("int8");
  });

  it("passes unknown types through lowercased", () => {
    expect(normalizeFieldType("  Geometry ", "postgres")).toBe("geometry");
  });
});

describe("formatRelativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-21T12:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it.each([
    ["2026-11-21T11:59:15Z", "45s ago"],
    ["2026-11-21T11:55:00Z", "5m ago"],
    ["2026-11-21T09:00:00Z", "3h ago"],
    ["2026-11-20T12:00:00Z", "1d ago"],
    ["2026-09-21T12:00:00Z", "2mo ago"],
  ])("formats %s as %s", (iso, want) => {
    expect(formatRelativeTime(iso)).toBe(want);
  });

  it.each(["", "not a date"])("returns Unknown date for %j", (iso) => {
    expect(formatRelativeTime(iso)).toBe("Unknown date");
  });
});
