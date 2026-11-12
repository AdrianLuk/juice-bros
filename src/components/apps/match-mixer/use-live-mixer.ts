"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { readLiveMixer } from "@/lib/match-mixer/actions";
import type { LiveMixer } from "@/lib/match-mixer/live-mixers";
import { liveMixerTopic, pollIntervalFor, socketFrom, type SocketState } from "@/lib/match-mixer/live-sync";
import { createClient } from "@/lib/match-mixer/supabase/client";

/** Every read of one Live Mixer through one link. */
export const liveMixerKey = (token: string) => ["match-mixer", "live", token];

/**
 * A Live Mixer read through one of its links that stays current (#688).
 * Every append broadcasts a data-free "changed" on `match-mixer:<id>` (the
 * trigger in the scores migration); on it, this re-reads. Team Tally's
 * `use-team-event-sync.ts` shape: Realtime only invalidates, the data comes
 * back through the normal read, and polling covers a missed message or a
 * socket that won't connect.
 *
 * `reconnecting` is true while the socket is down or reads are failing, so a
 * screen never passes off stale scores as live.
 */
export function useLiveMixer(token: string, initial: LiveMixer): { mixer: LiveMixer; reconnecting: boolean } {
  const queryClient = useQueryClient();

  // A missing env var makes createClient() throw; polling still covers it.
  const supabase = useMemo(() => {
    try {
      return createClient();
    } catch {
      return null;
    }
  }, []);
  const [socket, setSocket] = useState<SocketState>(supabase ? "connecting" : "dropped");

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel(liveMixerTopic(initial.id))
      .on("broadcast", { event: "changed" }, () => {
        void queryClient.invalidateQueries({ queryKey: liveMixerKey(token) });
      })
      .subscribe((status) => {
        const next = socketFrom(status);
        setSocket(next);
        // A score saved while the socket was joining was never broadcast to
        // it, and the live backstop is 15 seconds away: read once on joining.
        if (next === "live") void queryClient.invalidateQueries({ queryKey: liveMixerKey(token) });
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, initial.id, token, queryClient]);

  const read = useQuery({
    queryKey: liveMixerKey(token),
    queryFn: () => readLiveMixer(token),
    initialData: initial,
    // One retry, not three: a lost signal closes no socket, so a failing read is the quicker tell.
    retry: 1,
    refetchInterval: pollIntervalFor(socket),
  });

  return { mixer: read.data ?? initial, reconnecting: socket === "dropped" || read.isError };
}
