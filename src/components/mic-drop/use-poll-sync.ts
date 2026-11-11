"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { readPoll } from "@/lib/mic-drop/actions/guest";
import type { GuestPoll } from "@/lib/mic-drop/polls";
import { createClient } from "@/lib/mic-drop/supabase/client";

/** While the socket carries the updates: a backstop for a missed broadcast. */
const LIVE_POLL_MS = 15_000;
/** While the socket connects or is down: often enough to still feel live. */
const FALLBACK_POLL_MS = 4_000;

type Socket = "connecting" | "live" | "dropped";

function socketFrom(status: string): Socket {
  if (status === "SUBSCRIBED") return "live";
  if (status === "TIMED_OUT" || status === "CHANNEL_ERROR" || status === "CLOSED") return "dropped";
  return "connecting";
}

/**
 * A Poll read through its Guest Link that stays current (issue #670). Every
 * Vote, Contestant and close broadcasts a data-free "changed" on the Poll's
 * public topic `mic-drop:<poll id>` (the trigger in the Mic Drop migration);
 * on it, this re-reads. Team Tally's shape: Realtime only invalidates, the
 * data comes back through the normal read, and polling covers a missed
 * message or a socket that won't connect.
 *
 * `reconnecting` is true while the socket is down or reads are failing, so a
 * screen never passes off stale counts as live.
 *
 * `guestId`: this phone's, for its own Vote; null reads the Poll without one
 * (the Host's line-up). `enabled: false` holds the read until it's known.
 */
export function usePollSync(
  token: string,
  initial: GuestPoll,
  { guestId = null, enabled = true }: { guestId?: string | null; enabled?: boolean } = {},
): { poll: GuestPoll; reconnecting: boolean } {
  const queryClient = useQueryClient();

  // A missing env var makes createClient() throw; polling still covers it.
  const supabase = useMemo(() => {
    try {
      return createClient();
    } catch {
      return null;
    }
  }, []);
  const [socket, setSocket] = useState<Socket>(supabase ? "connecting" : "dropped");

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel(`mic-drop:${initial.id}`)
      .on("broadcast", { event: "changed" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["mic-drop", "poll", token] });
      })
      .subscribe((status) => setSocket(socketFrom(status)));
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, initial.id, token, queryClient]);

  const read = useQuery({
    queryKey: ["mic-drop", "poll", token, guestId],
    queryFn: () => readPoll(token, guestId),
    enabled,
    placeholderData: initial,
    refetchInterval: socket === "live" ? LIVE_POLL_MS : FALLBACK_POLL_MS,
  });

  return { poll: read.data ?? initial, reconnecting: socket === "dropped" || read.isError };
}
