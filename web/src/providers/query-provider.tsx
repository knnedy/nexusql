"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // useState ensures each session gets its own QueryClient instance
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Data is considered fresh for 30 seconds by default
            staleTime: 30_000,
            // Retry failed requests once before surfacing the error
            retry: 1,
            // Do not refetch when the window regains focus — this is a local
            // tool, background refetching is never useful here
            refetchOnWindowFocus: false,
            // Do not refetch on reconnect — the Go server is local, if it
            // is unreachable the user needs to restart it, not a silent retry
            refetchOnReconnect: false,
          },
          mutations: {
            // Surface mutation errors immediately
            retry: 0,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
