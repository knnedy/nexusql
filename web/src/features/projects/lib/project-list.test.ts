import { describe, expect, it } from "vitest";
import type { Project } from "@/shared/types/project";
import { countByProvider, visibleProjects } from "./project-list";

const p = (name: string, provider: Project["provider"], lastOpenedAt: string, displayUri = `${provider}://x/${name}`): Project => ({
  id: name, name, provider, displayUri, createdAt: lastOpenedAt, lastOpenedAt,
});
const ALL = [
  p("chinook", "sqlite", "2026-11-01T00:00:00Z", "sqlite:///data/chinook.db"),
  p("shop_dev", "postgres", "2026-11-26T10:00:00Z"),
  p("wordpress", "mysql", "2026-11-20T00:00:00Z", "mysql://root:***@127.0.0.1/wp"),
  p("billing", "postgres", "2026-11-25T00:00:00Z"),
];

describe("visibleProjects", () => {
  it("lists the most recently opened first", () => {
    expect(visibleProjects(ALL, "", "all").map((x) => x.name)).toEqual(["shop_dev", "billing", "wordpress", "chinook"]);
  });

  it("narrows by database and by name or address, ignoring case", () => {
    expect(visibleProjects(ALL, "", "postgres").map((x) => x.name)).toEqual(["shop_dev", "billing"]);
    expect(visibleProjects(ALL, "127.0", "all").map((x) => x.name)).toEqual(["wordpress"]);
    expect(visibleProjects(ALL, " CHIN ", "all").map((x) => x.name)).toEqual(["chinook"]);
    expect(visibleProjects(ALL, "chin", "mysql")).toEqual([]);
  });
});

it("counts the projects of each database", () => {
  expect(countByProvider(ALL)).toEqual({ all: 4, postgres: 2, mysql: 1, sqlite: 1 });
});
