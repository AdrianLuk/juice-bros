"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * TanStack Query for a Live Mixer's two links (#688), the posture of Team
 * Tally's and Mic Drop's providers: the server renders the first read, Query
 * keeps it current. The offline tool at `/tools/match-mixer` never mounts it.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 2_000 } } }),
  );
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
