import { queryOptions } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { queryKeys } from "@/shared/api/query-keys";

export const exportQueryOptions = (
  type: "png" | "prisma" | "drizzle" | null,
  enabled: boolean,
) =>
  queryOptions({
    queryKey: queryKeys.export(type),
    queryFn: () =>
      type === "prisma" ? api.export.prisma() : api.export.drizzle(),
    enabled: enabled && !!type && type !== "png",
    staleTime: Infinity,
  });
