"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { readLiveEvent, type LiveReader, type LiveView } from "@/lib/team-tally/actions/live";
import { useTeamEventSync } from "./use-team-event-sync";

/**
 * A running Team Event on a live screen: the server's first read, kept
 * current by the Realtime broadcast and the poll behind it. `refresh` re-reads
 * now, for the screen that just saved something.
 */
export function useLiveEvent(reader: LiveReader, initial: LiveView) {
  const queryClient = useQueryClient();
  const queryKey = ["team-tally", "live", reader] as const;
  const pollInterval = useTeamEventSync(initial.event.id, [queryKey]);

  const query = useQuery({
    queryKey,
    queryFn: () => readLiveEvent(reader),
    initialData: initial,
    refetchInterval: pollInterval,
  });

  const keyHash = JSON.stringify(queryKey);
  const refresh = useCallback(
    () => queryClient.invalidateQueries({ queryKey: JSON.parse(keyHash) }),
    [queryClient, keyHash],
  );

  // A link that stops working mid-night keeps showing the last good read.
  return { view: query.data ?? initial, refresh };
}
