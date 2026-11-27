import { queryOptions } from "@tanstack/react-query";
import { api } from "@/shared/api/client";
import { queryKeys } from "@/shared/api/query-keys";

/** The order a seed fills tables in; under the schema's key, it changes only with it. */
export const seedPlanQueryOptions = () =>
  queryOptions({ queryKey: queryKeys.seedPlan(), queryFn: api.seedPlan, staleTime: Infinity });

/** Made-up rows of one table, nothing written; a new round asks for fresh ones. */
export const seedSampleQueryOptions = (table: string, rows: number, nullChance: number, round: number) =>
  queryOptions({
    queryKey: queryKeys.seedSample(table, rows, nullChance, round),
    queryFn: () => api.seedSample({ table, rows, nullChance }),
    staleTime: Infinity,
  });
