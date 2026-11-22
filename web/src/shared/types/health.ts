import type { DatabaseProvider } from "@/shared/types/provider";

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

/** A schema export the server offers (GET /api/export). */
export interface ExportFormat {
  id: string;
  label: string;
  description: string;
  /** Syntax highlighting language. */
  language: string;
  filename: string;
}

export interface ExportFormatsResponse {
  formats: ExportFormat[];
}

export interface ExportResponse {
  format: string;
  schema: string;
}
