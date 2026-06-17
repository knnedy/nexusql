import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "./api";
import type {
  ConnectRequest,
  ConnectResponse,
  CreateProjectRequest,
  CreateProjectResponse,
  HealthResponse,
  OrmExportResponse,
  ProjectsResponse,
  RowsResponse,
  SchemaResponse,
} from "./types";

// Query option factories
export const queries = {
  health: () =>
    queryOptions<HealthResponse>({
      queryKey: ["health"],
      queryFn: api.health,
      retry: 3,
      staleTime: 30_000,
    }),

  schema: () =>
    queryOptions<SchemaResponse>({
      queryKey: ["schema"],
      queryFn: api.schema,
      retry: 2,
      staleTime: 60_000,
    }),

  rows: (tableName: string) =>
    queryOptions<RowsResponse>({
      queryKey: ["rows", tableName],
      queryFn: () => api.rows(tableName),
      enabled: tableName.length > 0,
      retry: 1,
      staleTime: 30_000,
    }),

  projects: () =>
    queryOptions<ProjectsResponse>({
      queryKey: ["projects"],
      queryFn: api.projects.list,
      retry: 2,
      staleTime: Infinity,
    }),

  export: (target: "prisma" | "drizzle") =>
    queryOptions<OrmExportResponse>({
      queryKey: ["export", target],
      queryFn: target === "prisma" ? api.export.prisma : api.export.drizzle,
      retry: 1,
      staleTime: Infinity,
    }),
} as const;

// Hooks
export function useHealth(): UseQueryResult<HealthResponse> {
  return useQuery(queries.health());
}

export function useSchema(enabled = true): UseQueryResult<SchemaResponse> {
  return useQuery({ ...queries.schema(), enabled });
}

export function useRows(
  tableName: string,
  enabled = true,
): UseQueryResult<RowsResponse> {
  return useQuery({ ...queries.rows(tableName), enabled });
}

export function useProjects(): UseQueryResult<ProjectsResponse> {
  return useQuery(queries.projects());
}

export function useOrmExport(
  target: "prisma" | "drizzle",
  enabled = true,
): UseQueryResult<OrmExportResponse> {
  return useQuery({ ...queries.export(target), enabled });
}

// connect to a database
export function useConnect(): UseMutationResult<
  ConnectResponse,
  Error,
  ConnectRequest
> {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: api.connect,
    onSuccess: (data) => {
      if (data.ok) {
        queryClient.invalidateQueries(queries.schema());
        router.push("/studio");
      }
    },
  });
}

// disconnect from the active database
export function useDisconnect(): UseMutationResult<void, Error, void> {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: api.disconnect,
    onSuccess: () => {
      queryClient.clear();
      router.push("/");
    },
  });
}

// create a project
export function useCreateProject(): UseMutationResult<
  CreateProjectResponse,
  Error,
  CreateProjectRequest
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.projects.create,
    onSuccess: () => {
      queryClient.invalidateQueries(queries.projects());
    },
  });
}

// delete a project
export function useRemoveProject(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.projects.remove,
    onSuccess: () => {
      queryClient.invalidateQueries(queries.projects());
    },
  });
}

// update last opened timestamp
export function useUpdateLastOpened(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: api.projects.updateLastOpened,
    onSuccess: () => {
      queryClient.invalidateQueries(queries.projects());
    },
  });
}
