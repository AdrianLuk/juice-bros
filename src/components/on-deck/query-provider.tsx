"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * TanStack Query for On Deck's live surfaces — the floor screen and a Player's
 * own position line. Both re-fetch `getRotationView` on a Realtime notify
 * (issue #252), with a poll as the fallback when the socket drops (issue #243).
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
