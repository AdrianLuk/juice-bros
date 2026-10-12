"use client";

import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { readLiveEvent, type LiveReader, type LiveView } from "@/lib/team-tally/actions/live";
import { freshnessFor, type Freshness } from "@/lib/team-tally/live-sync";
import { useTeamEventSync } from "./use-team-event-sync";

/**
 * A running Team Event on a live screen: the server's first read, kept
 * current by the Realtime broadcast and the poll behind it. `refresh` re-reads
 * now, for the screen that just saved something; `freshness` says when the
 * reads have stopped landing (issue #661).
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

  // Failing: a read is retrying, the last one errored, or the browser is offline and Query has paused.
  const failing = query.failureCount > 0 || query.errorUpdatedAt > query.dataUpdatedAt || query.fetchStatus === "paused";

  // A link that stops working mid-night keeps showing the last good read, and says so.
  return { view: query.data ?? initial, refresh, freshness: useFreshness(failing) };
}

/** How long reads have been failing, as a Freshness, re-checked every few seconds while they are. */
function useFreshness(failing: boolean): Freshness {
  const [failingFor, setFailingFor] = useState(0);

  useEffect(() => {
    if (!failing) return;
    const since = Date.now();
    const tick = setInterval(() => setFailingFor(Date.now() - since), 5_000);
    return () => {
      clearInterval(tick);
      setFailingFor(0);
    };
  }, [failing]);

  return freshnessFor(failing ? failingFor : null);
}
