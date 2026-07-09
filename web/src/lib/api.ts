import {
  ConnectRequest,
  ConnectResponse,
  HealthResponse,
  OrmExportResponse,
} from "./types/health";
import {
  CreateProjectRequest,
  CreateProjectResponse,
  ProjectsResponse,
} from "./types/project";
import { QueryRequest, QueryResponse } from "./types/query";
import {
  LookupResponse,
  RowsResponse,
  UpdateRowRequest,
  UpdateRowResponse,
} from "./types/rows";
import { SchemaResponse } from "./types/schema";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

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

  disconnect(): Promise<void> {
    return request<void>("/api/disconnect", { method: "POST" });
  },

  schema(): Promise<SchemaResponse> {
    return request<SchemaResponse>("/api/schema");
  },

  rows(
    tableName: string,
    page = 1,
    pageSize = 50,
    sortCol = "",
    sortDir: "asc" | "desc" = "asc",
    search = "",
  ): Promise<RowsResponse> {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
    });
    if (sortCol) {
      params.set("sort", sortCol);
      params.set("dir", sortDir);
    }
    if (search) {
      params.set("search", search);
    }
    return request<RowsResponse>(
      `/api/rows/${encodeURIComponent(tableName)}?${params.toString()}`,
    );
  },

  lookup(
    tableName: string,
    field: string,
    value: string,
  ): Promise<LookupResponse> {
    const params = new URLSearchParams({ field, value });
    return request<LookupResponse>(
      `/api/rows/${encodeURIComponent(tableName)}/lookup?${params.toString()}`,
    );
  },

  updateRow(
    tableName: string,
    body: UpdateRowRequest,
  ): Promise<UpdateRowResponse> {
    return request<UpdateRowResponse>(
      `/api/rows/${encodeURIComponent(tableName)}`,
      {
        method: "PATCH",
        body: JSON.stringify(body),
      },
    );
  },

  query(body: QueryRequest): Promise<QueryResponse> {
    return request<QueryResponse>("/api/query", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

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

    rename(id: string, name: string): Promise<void> {
      return request<void>(`/api/projects/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
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

  export: {
    prisma(): Promise<OrmExportResponse> {
      return request<OrmExportResponse>("/api/export/prisma");
    },

    drizzle(): Promise<OrmExportResponse> {
      return request<OrmExportResponse>("/api/export/drizzle");
    },
  },
} as const;
