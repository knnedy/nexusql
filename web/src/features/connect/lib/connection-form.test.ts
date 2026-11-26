import { describe, expect, it } from "vitest";
import { detectProvider, validateConnection } from "./connection-form";

describe("detectProvider", () => {
  it("knows each database from the URI's scheme, and nothing from a partial one", () => {
    expect(detectProvider("postgresql://u@h/db")).toBe("postgres");
    expect(detectProvider("postgres://u@h/db")).toBe("postgres");
    expect(detectProvider("mysql://root@127.0.0.1/app")).toBe("mysql");
    expect(detectProvider("sqlite:///tmp/a.db")).toBe("sqlite");
    expect(detectProvider("postg")).toBeNull();
  });
});

describe("validateConnection", () => {
  it("needs a name and a URI", () => {
    expect(validateConnection({ name: " ", uri: "", provider: "postgres" })).toEqual({
      name: "Give the project a name.",
      uri: "Paste a connection URI.",
    });
  });

  it("wants the chosen database's scheme", () => {
    expect(validateConnection({ name: "shop", uri: "mysql://root@h/app", provider: "postgres" })).toEqual({
      uri: "A PostgreSQL URI starts with postgres:// or postgresql://.",
    });
    expect(validateConnection({ name: "shop", uri: "postgres://u@h/db", provider: "postgres" })).toEqual({});
  });
});
