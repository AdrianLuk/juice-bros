"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { readLive, type LiveReader } from "@/lib/ddd/actions/live";
import type { LinkEvent } from "@/lib/ddd/events";
import { dddTopic, pollIntervalFor, statusFromChannel, type RealtimeStatus } from "@/lib/ddd/live-sync";
import { createClient } from "@/lib/ddd/supabase/client";

/**
 * A DDD on a live screen (#715): the server's first read, kept current by
 * the Realtime "changed" broadcast and a poll behind it, as Team Tally's
 * `use-live-event.ts` does. Realtime only invalidates; the data comes back
 * through `readLive`. `refresh` re-reads now, for the screen that just saved.
 */
export function useDddLive(reader: LiveReader, initial: LinkEvent) {
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ["ddd", "live", reader] as const, [reader]);

  // A missing env var makes createClient() throw; the poll still covers it.
  const supabase = useMemo(() => {
    try {
      return createClient();
    } catch {
      return null;
    }
  }, []);
  const [status, setStatus] = useState<RealtimeStatus>(supabase ? "connecting" : "dropped");

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel(dddTopic(initial.id))
      .on("broadcast", { event: "changed" }, () => queryClient.invalidateQueries({ queryKey }))
      .subscribe((channelStatus) => setStatus(statusFromChannel(channelStatus)));
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, initial.id, queryClient, queryKey]);

  const query = useQuery({
    queryKey,
    queryFn: () => readLive(reader),
    initialData: initial,
    refetchInterval: pollIntervalFor(status),
  });

  const refresh = useCallback(() => queryClient.invalidateQueries({ queryKey }), [queryClient, queryKey]);

  // A link that stops working mid-day keeps showing the last good read.
  return { event: query.data ?? initial, refresh };
}
