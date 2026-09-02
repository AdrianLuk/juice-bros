"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";

import { createClient } from "@/lib/on-deck/supabase/client";
import {
  pollIntervalFor,
  statusFromChannel,
  type ChannelStatus,
  type RealtimeStatus,
} from "@/lib/on-deck/session/realtime";

/**
 * Subscribes the caller's live surface to `on_deck_session_events` inserts for
 * one Session (issue #252) and invalidates its rotation query on every notify,
 * so a "Court done" tap on another phone lands here in ~1s instead of a poll
 * interval later.
 *
 * Returns the poll interval the caller should hand TanStack Query's
 * `refetchInterval`: the slow backstop cadence while the socket is confirmed
 * live, the full pre-Realtime cadence while connecting or after a drop. So a
 * dropped socket automatically falls back to polling, and a reconnect
 * automatically resumes Realtime — no caller branching.
 *
 * RLS applies to the channel exactly as to a REST read: the anon-key client
 * only receives events for a Session it can already SELECT (an open Session,
 * ADR 0006), so no token or private data crosses the socket.
 */
export function useRotationSync(
  sessionId: string,
  queryKeys: QueryKey[],
): number {
  const queryClient = useQueryClient();

  // A missing NEXT_PUBLIC_SUPABASE_ANON_KEY makes createClient() throw. That
  // must not take the surface down — polling is the whole fallback story — so
  // build the client during render (a stable condition, not an effect concern)
  // and, if it fails, just never open a channel and stay on the fallback
  // cadence.
  const supabase = useMemo(() => {
    try {
      return createClient();
    } catch {
      return null;
    }
  }, []);

  const [status, setStatus] = useState<RealtimeStatus>(
    supabase ? "connecting" : "dropped",
  );

  // Call sites pass fresh array literals every render, so depend on a stable
  // serialization rather than the array identity — otherwise the channel would
  // tear down and re-subscribe on every parent re-render.
  const keysHash = JSON.stringify(queryKeys);

  useEffect(() => {
    if (!supabase) return;
    const keys = JSON.parse(keysHash) as QueryKey[];

    const invalidate = () => {
      for (const key of keys) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    };

    const channel = supabase
      .channel(`on-deck:session:${sessionId}`)
      .on(
        "postgres_changes",
        {
          // `*`, not just INSERT: operator Undo (#247) is the one DELETE path,
          // and a re-fold after it has to reach the other surfaces too.
          event: "*",
          schema: "public",
          table: "on_deck_session_events",
          filter: `session_id=eq.${sessionId}`,
        },
        invalidate,
      )
      .subscribe((channelStatus) => {
        setStatus(statusFromChannel(channelStatus as ChannelStatus));
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, sessionId, keysHash, queryClient]);

  return pollIntervalFor(status);
}
