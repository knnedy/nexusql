import { QueryClient } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { api } from "@/shared/api/client";
import {
  connectionEntries,
  fillConnectionCache,
  openProject,
  withClient,
} from "@/test/connection-cache";
import { useDisconnect } from "./use-disconnect";

beforeEach(() => openProject("shop"));

it("forgets everything cached from the connection", async () => {
  vi.spyOn(api, "disconnect").mockResolvedValue(undefined);
  const qc = new QueryClient();
  fillConnectionCache(qc);

  const { result } = renderHook(() => useDisconnect(), { wrapper: withClient(qc) });
  result.current.mutate();

  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(connectionEntries(qc)).toEqual([]);
});
