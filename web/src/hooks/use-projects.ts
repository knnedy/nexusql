import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "@/lib/api";

export const projectsQueryOptions = queryOptions({
  queryKey: ["projects"],
  queryFn: () => api.projects.list(),
});

export function useProjects() {
  return useQuery(projectsQueryOptions);
}

export function useRenameProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api.projects.rename(id, name),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: projectsQueryOptions.queryKey }),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.projects.remove(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: projectsQueryOptions.queryKey }),
  });
}

export function useTouchProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.projects.updateLastOpened(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: projectsQueryOptions.queryKey }),
  });
}
