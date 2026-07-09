import type { DatabaseProvider, OrmTarget } from "./provider";

export interface HealthResponse {
  status: "ok";
  version: string;
}

export interface ConnectRequest {
  uri: string;
  provider: DatabaseProvider;
  name: string;
}

export interface ConnectResponse {
  ok: boolean;
  provider: DatabaseProvider;
  projectId: string;
}

export interface OrmExportResponse {
  target: OrmTarget;
  schema: string;
}
