import type { DatabaseProvider, OrmTarget } from "@/shared/types/provider";

export interface HealthResponse {
  status: "ok";
  version: string;
}

/** Connect to a new URI (saved as a project), or reopen a saved project by id. */
export type ConnectRequest =
  | { uri: string; provider: DatabaseProvider; name: string }
  | { projectId: string; name: string };

export interface ConnectResponse {
  ok: boolean;
  provider: DatabaseProvider;
  projectId: string;
}

export interface OrmExportResponse {
  target: OrmTarget;
  schema: string;
}
