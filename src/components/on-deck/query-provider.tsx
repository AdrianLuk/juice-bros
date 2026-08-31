"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * TanStack Query for On Deck's live surfaces — the floor screen and a Player's
 * own position line, both of which poll `getRotationView` every few seconds
 * (issue #243). Realtime is a later upgrade (#238 ticket 13).
 *
 * Scoped to these routes deliberately, the same posture as Booking Buddy's
 * provider (see CLAUDE.md) — the marketing pages stay on plain server
 * components.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  // useState keeps one client per component instance; a module-level client
  // would be shared across every request on the server.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 2_000 },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
