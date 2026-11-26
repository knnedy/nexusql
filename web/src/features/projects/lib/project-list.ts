import type { Project } from "@/shared/types/project";
import type { DatabaseProvider } from "@/shared/types/provider";

export type ProviderFilter = DatabaseProvider | "all";

/** Projects for the list: one database or all, matching name or address, newest first. */
export function visibleProjects(projects: Project[], search: string, provider: ProviderFilter): Project[] {
  const q = search.trim().toLowerCase();
  return projects
    .filter((p) => provider === "all" || p.provider === provider)
    .filter((p) => !q || p.name.toLowerCase().includes(q) || p.displayUri.toLowerCase().includes(q))
    .sort((a, b) => Date.parse(b.lastOpenedAt) - Date.parse(a.lastOpenedAt));
}

export function countByProvider(projects: Project[]): Record<ProviderFilter, number> {
  const counts: Record<ProviderFilter, number> = { all: projects.length, postgres: 0, mysql: 0, sqlite: 0 };
  for (const p of projects) counts[p.provider]++;
  return counts;
}
