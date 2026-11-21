import type { DatabaseProvider } from "@/shared/types/provider";

// Per-tab connection info that survives reloads. The only place these keys exist.
const KEYS = {
  provider: "nexusql_provider",
  projectId: "nexusql_project_id",
  projectName: "nexusql_project_name",
} as const;

function read(key: keyof typeof KEYS): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(KEYS[key]);
}

export const studioSession = {
  provider: () => read("provider") as DatabaseProvider | null,
  projectId: () => read("projectId"),
  projectName: () => read("projectName"),

  setProjectName(name: string) {
    sessionStorage.setItem(KEYS.projectName, name);
  },

  save(s: { provider: DatabaseProvider; projectId: string; projectName: string }) {
    sessionStorage.setItem(KEYS.provider, s.provider);
    sessionStorage.setItem(KEYS.projectId, s.projectId);
    sessionStorage.setItem(KEYS.projectName, s.projectName);
  },

  clear() {
    for (const k of Object.values(KEYS)) sessionStorage.removeItem(k);
  },
};
