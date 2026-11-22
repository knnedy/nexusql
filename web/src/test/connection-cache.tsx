import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { vi } from "vitest";
import { projectsQueryOptions } from "@/shared/hooks/use-projects";
import { schemaQueryOptions } from "@/shared/hooks/use-schema";
import { tableRowsQueryOptions } from "@/shared/hooks/use-table-rows";
import { exportQueryOptions } from "@/shared/hooks/use-export";
import { readOnlyQueryOptions } from "@/shared/hooks/use-read-only";
import { studioSession } from "@/shared/lib/session-storage";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

export function openProject(projectId: string) {
  studioSession.save({ provider: "sqlite", projectId, projectName: projectId });
}

/** Caches one of everything the studio reads from the active connection. */
export function fillConnectionCache(qc: QueryClient) {
  qc.setQueryData(schemaQueryOptions().queryKey, { tables: [], relations: [], enums: [] } as never);
  qc.setQueryData(tableRowsQueryOptions("users", true).queryKey, { rows: [] } as never);
  qc.setQueryData(exportQueryOptions("prisma", true).queryKey, { schema: "" } as never);
  qc.setQueryData(readOnlyQueryOptions().queryKey, { readOnly: true });
  qc.setQueryData(projectsQueryOptions.queryKey, { projects: [] } as never);
}

/** Cached entries other than the project list, which outlives connections. */
export function connectionEntries(qc: QueryClient): unknown[] {
  const projects = JSON.stringify(projectsQueryOptions.queryKey);
  return qc
    .getQueryCache()
    .getAll()
    .map((q) => q.queryKey)
    .filter((k) => JSON.stringify(k) !== projects);
}

export function withClient(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}
