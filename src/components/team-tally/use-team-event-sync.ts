"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";

import { pollIntervalFor, statusFromChannel, teamEventTopic, type RealtimeStatus } from "@/lib/team-tally/live-sync";
import { createClient } from "@/lib/team-tally/supabase/client";

/**
 * Listens for the "changed" broadcast a Game or Player slot write sends on its
 * Team Event's topic (issue #623) and invalidates the caller's queries, so a
 * score typed on one phone lands on the others within a second or two. The
 * pattern of On Deck's `use-rotation-sync.ts`: Realtime only invalidates; the
 * data comes back through the normal read.
 *
 * Returns the `refetchInterval` to use: a slow backstop while the socket is
 * live, the full fallback poll while it connects or after it drops.
 */
export function useTeamEventSync(eventId: string, queryKeys: QueryKey[]): number {
  const queryClient = useQueryClient();

  // A missing env var makes createClient() throw; polling still covers it.
  const supabase = useMemo(() => {
    try {
      return createClient();
    } catch {
      return null;
    }
  }, []);

  const [status, setStatus] = useState<RealtimeStatus>(supabase ? "connecting" : "dropped");

  // Call sites pass fresh array literals; depend on their serialization.
  const keysHash = JSON.stringify(queryKeys);

  useEffect(() => {
    if (!supabase) return;
    const keys = JSON.parse(keysHash) as QueryKey[];

    const channel = supabase
      .channel(teamEventTopic(eventId))
      .on("broadcast", { event: "changed" }, () => {
        for (const key of keys) {
          queryClient.invalidateQueries({ queryKey: key });
        }
      })
      .subscribe((channelStatus) => {
        setStatus(statusFromChannel(channelStatus));
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, eventId, keysHash, queryClient]);

  return pollIntervalFor(status);
}
