import { afterEach, describe, expect, it } from "vitest";
import { studioSession } from "./session-storage";

afterEach(() => sessionStorage.clear());

describe("studioSession", () => {
  it("returns null for everything before a connection is saved", () => {
    expect(studioSession.provider()).toBeNull();
    expect(studioSession.projectId()).toBeNull();
    expect(studioSession.projectName()).toBeNull();
  });

  it("remembers a saved connection", () => {
    studioSession.save({ provider: "mysql", projectId: "p1", projectName: "Shop" });

    expect(studioSession.provider()).toBe("mysql");
    expect(studioSession.projectId()).toBe("p1");
    expect(studioSession.projectName()).toBe("Shop");
  });

  it("sets the project name on its own before connecting", () => {
    studioSession.setProjectName("Draft");

    expect(studioSession.projectName()).toBe("Draft");
    expect(studioSession.projectId()).toBeNull();
  });

  it("forgets everything on clear", () => {
    studioSession.save({ provider: "sqlite", projectId: "p2", projectName: "Local" });
    studioSession.clear();

    expect(studioSession.provider()).toBeNull();
    expect(studioSession.projectId()).toBeNull();
    expect(studioSession.projectName()).toBeNull();
  });
});
