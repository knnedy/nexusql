import { QueryClient } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { api } from "@/shared/api/client";
import { projectsQueryOptions } from "@/shared/hooks/use-projects";
import { fillConnectionCache, openProject, withClient } from "@/test/connection-cache";
import type { QueryResponse } from "@/shared/types/query";
import { useRunQuery } from "./use-run-query";

const write: QueryResponse = {
  columns: [], rows: [], rowsAffected: 0, isWrite: true,
  truncated: false, statements: 1, requiresConfirmation: false,
};

it("a console write marks everything read from the connection stale", async () => {
  openProject("shop");
  vi.spyOn(api, "query").mockResolvedValue(write);
  const qc = new QueryClient();
  fillConnectionCache(qc);

  const { result } = renderHook(() => useRunQuery(), { wrapper: withClient(qc) });
  result.current.mutate({ sql: "CREATE TABLE t (x int)", confirmed: true });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));

  const projects = JSON.stringify(projectsQueryOptions.queryKey);
  const fresh = qc
    .getQueryCache()
    .getAll()
    .filter((q) => JSON.stringify(q.queryKey) !== projects && !q.state.isInvalidated);
  expect(fresh.map((q) => q.queryKey)).toEqual([]); // schema and exports included: DDL
});
