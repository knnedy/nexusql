import type { QueryClient } from "@tanstack/react-query";
import { studioSession } from "@/shared/lib/session-storage";

const CONNECTION = "connection";

// Everything read from the active connection is keyed under its project, so
// one project's cache can never answer for another.
function scope() {
  return [CONNECTION, studioSession.projectId() ?? ""] as const;
}

/** Query keys; prefixes double as invalidation targets. */
export const queryKeys = {
  projects: ["projects"] as const,
  // The format list belongs to the server, not to a connection.
  exportFormats: ["export-formats"] as const,
  connection: () => scope(),
  schema: () => [...scope(), "schema"] as const,
  rows: () => [...scope(), "rows"] as const,
  tableRows: (table: string) => [...scope(), "rows", table] as const,
  lookups: () => [...scope(), "lookup"] as const,
  tableLookups: (table: string) => [...scope(), "lookup", table] as const,
  export: (target: string | null) => [...scope(), "export", target] as const,
  readOnly: () => [...scope(), "read-only"] as const,
};

/** Drops everything cached from any connection; call on connect and disconnect. */
export function forgetConnection(qc: QueryClient) {
  qc.removeQueries({ queryKey: [CONNECTION] });
}
