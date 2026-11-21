"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * TanStack Query for DDD's live screens only (the Score Link, the Public
 * Link and the Organizer's Round 1): the server renders the first read,
 * Query keeps it current.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 2_000 } } }));
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
