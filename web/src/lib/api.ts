import type {
  ConnectRequest,
  ConnectResponse,
  HealthResponse,
  RowsResponse,
  SchemaResponse,
} from "./types";

// Base URL for the Go backend — overridable via env for development
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:7070";

// Core fetch wrapper — centralises error handling and JSON parsing
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

// API methods
export const api = {
  health(): Promise<HealthResponse> {
    return request<HealthResponse>("/api/health");
  },

  connect(body: ConnectRequest): Promise<ConnectResponse> {
    return request<ConnectResponse>("/api/connect", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  schema(): Promise<SchemaResponse> {
    return request<SchemaResponse>("/api/schema");
  },

  rows(tableName: string): Promise<RowsResponse> {
    return request<RowsResponse>(`/api/rows/${encodeURIComponent(tableName)}`);
  },
} as const;
