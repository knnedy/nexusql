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
  // Under schema, so whatever refreshes the schema refreshes the DDL too.
  tableDdl: (table: string) => [...scope(), "schema", "ddl", table] as const,
  seedPlan: () => [...scope(), "schema", "seed-plan"] as const,
  seedSample: (table: string, rows: number, nullChance: number, round: number) => [...scope(), "schema", "seed-sample", table, rows, nullChance, round] as const,
  rows: () => [...scope(), "rows"] as const,
  tableRows: (table: string) => [...scope(), "rows", table] as const,
  export: (target: string | null, tables: readonly string[] = []) => [...scope(), "export", target, ...tables] as const,
  readOnly: () => [...scope(), "read-only"] as const,
};

/** Drops everything cached from any connection; call on connect and disconnect. */
export function forgetConnection(qc: QueryClient) {
  qc.removeQueries({ queryKey: [CONNECTION] });
}
