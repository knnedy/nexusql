import { QueryClient } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { api } from "@/shared/api/client";
import { tableRowsQueryOptions } from "@/shared/hooks/use-table-rows";
import {
  connectionEntries,
  fillConnectionCache,
  openProject,
  withClient,
} from "@/test/connection-cache";
import { useConnect } from "./use-connect";

beforeEach(() => openProject("shop"));

it("starts the new connection with nothing cached from the old one", async () => {
  vi.spyOn(api, "connect").mockResolvedValue({ ok: true, provider: "sqlite", projectId: "blog" });
  const qc = new QueryClient();
  fillConnectionCache(qc);

  const { result } = renderHook(() => useConnect(), { wrapper: withClient(qc) });
  result.current.mutate({ projectId: "blog", name: "blog" });

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(connectionEntries(qc)).toEqual([]);
});

it("never serves one project's rows for another", () => {
  const qc = new QueryClient();
  qc.setQueryData(tableRowsQueryOptions("users", true).queryKey, { rows: ["shop"] } as never);
  openProject("blog");
  expect(qc.getQueryData(tableRowsQueryOptions("users", true).queryKey)).toBeUndefined();
});
