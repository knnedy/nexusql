import {
  ConnectRequest,
  ConnectResponse,
  ExportFormatsResponse,
  ExportResponse,
  HealthResponse,
} from "@/shared/types/health";
import {
  CreateProjectRequest,
  CreateProjectResponse,
  ProjectsResponse,
} from "@/shared/types/project";
import {
  QueryRequest,
  QueryResponse,
  ReadOnlyState,
} from "@/shared/types/query";
import {
  RowsResponse,
  UpdateRowRequest,
  UpdateRowResponse,
} from "@/shared/types/rows";
import { SchemaResponse } from "@/shared/types/schema";
import type { SeedRequest, SeedResponse, SeedSample } from "@/shared/types/seed";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

/** The server's {"error": "..."} message, or the raw body when it has none. */
function errorMessage(body: string): string {
  try {
    const parsed: unknown = JSON.parse(body);
    if (
      parsed &&
      typeof parsed === "object" &&
      "error" in parsed &&
      typeof parsed.error === "string"
    ) {
      return parsed.error;
    }
  } catch {
    // not JSON: use the body as it is
  }
  return body.trim();
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!response.ok) {
    throw new Error(
      errorMessage(await response.text()) ||
        `Request failed with status ${response.status}`,
    );
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
    filters = "",
    after: string[] | null = null,
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
    if (filters) {
      params.set("filters", filters); // JSON, as serializeFilters writes it
    }
    if (after) {
      params.set("after", JSON.stringify(after));
    }
    return request<RowsResponse>(
      `/api/rows/${encodeURIComponent(tableName)}?${params.toString()}`,
    );
  },

  rowCount(tableName: string, search = "", filters = ""): Promise<{ total: number }> {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (filters) params.set("filters", filters);
    return request<{ total: number }>(
      `/api/rows/${encodeURIComponent(tableName)}/count?${params.toString()}`,
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

  readOnly: {
    get(): Promise<ReadOnlyState> {
      return request<ReadOnlyState>("/api/connection/read-only");
    },

    set(body: ReadOnlyState): Promise<ReadOnlyState> {
      return request<ReadOnlyState>("/api/connection/read-only", {
        method: "PUT",
        body: JSON.stringify(body),
      });
    },
  },

  seed(body: SeedRequest, signal?: AbortSignal): Promise<SeedResponse> {
    return request<SeedResponse>("/api/seed", {
      method: "POST",
      body: JSON.stringify(body),
      signal,
    });
  },

  seedPlan(): Promise<{ order: string[] }> {
    return request<{ order: string[] }>("/api/seed/plan");
  },

  seedSample(body: { table: string; rows: number; nullChance: number }): Promise<SeedSample> {
    return request<SeedSample>("/api/seed/sample", { method: "POST", body: JSON.stringify(body) });
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

  tables: {
    ddl(table: string): Promise<{ ddl: string }> {
      return request<{ ddl: string }>(`/api/tables/${encodeURIComponent(table)}/ddl`);
    },
  },

  export: {
    formats(): Promise<ExportFormatsResponse> {
      return request<ExportFormatsResponse>("/api/export");
    },

    /** No tables means the whole schema. */
    render(format: string, tables: string[] = []): Promise<ExportResponse> {
      const query = tables.length ? `?${new URLSearchParams(tables.map((t) => ["tables", t]))}` : "";
      return request<ExportResponse>(`/api/export/${encodeURIComponent(format)}${query}`);
    },
  },
} as const;
