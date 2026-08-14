"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * TanStack Query for Booking Buddy's interactive routes.
 *
 * Scoped to this section deliberately — the marketing and podcast pages stay
 * on plain server components (see CLAUDE.md).
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  // useState keeps one client per component instance. A module-level client
  // would be shared across every request on the server.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Data arrives hydrated from a server component; without a stale
            // window the client would immediately refetch it on mount.
            staleTime: 30_000,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
