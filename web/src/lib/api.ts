import type {
  ConnectRequest,
  ConnectResponse,
  CreateProjectRequest,
  CreateProjectResponse,
  HealthResponse,
  ProjectsResponse,
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
  // Health
  health(): Promise<HealthResponse> {
    return request<HealthResponse>("/api/health");
  },

  // Connection
  connect(body: ConnectRequest): Promise<ConnectResponse> {
    return request<ConnectResponse>("/api/connect", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  disconnect(): Promise<void> {
    return request<void>("/api/disconnect", { method: "POST" });
  },

  // Schema
  schema(): Promise<SchemaResponse> {
    return request<SchemaResponse>("/api/schema");
  },

  // Table rows — safe SELECT * LIMIT 10
  rows(tableName: string): Promise<RowsResponse> {
    return request<RowsResponse>(`/api/rows/${encodeURIComponent(tableName)}`);
  },

  // Projects
  projects: {
    list(): Promise<ProjectsResponse> {
      return request<ProjectsResponse>("/api/projects");
    },

    create(body: CreateProjectRequest): Promise<CreateProjectResponse> {
      return request<CreateProjectResponse>("/api/projects", {
        method: "POST",
        body: JSON.stringify(body),
      });
    },

    remove(id: string): Promise<void> {
      return request<void>(`/api/projects/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
    },

    updateLastOpened(id: string): Promise<void> {
      return request<void>(`/api/projects/${encodeURIComponent(id)}/opened`, {
        method: "PATCH",
      });
    },
  },

  // ORM export
  export: {
    prisma(): Promise<{ schema: string }> {
      return request<{ schema: string }>("/api/export/prisma");
    },

    drizzle(): Promise<{ schema: string }> {
      return request<{ schema: string }>("/api/export/drizzle");
    },
  },
} as const;
