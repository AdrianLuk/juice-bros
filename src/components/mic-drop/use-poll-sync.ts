"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { readPoll } from "@/lib/mic-drop/actions/guest";
import type { GuestPoll } from "@/lib/mic-drop/polls";
import { pollIntervalFor, pollTopic, socketFrom, type SocketState } from "@/lib/mic-drop/live-sync";
import { createClient } from "@/lib/mic-drop/supabase/client";

/** Every read of one Poll, whichever phone's Vote it carries. */
const pollKey = (token: string) => ["mic-drop", "poll", token];

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
  const [socket, setSocket] = useState<SocketState>(supabase ? "connecting" : "dropped");

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel(pollTopic(initial.id))
      .on("broadcast", { event: "changed" }, () => {
        void queryClient.invalidateQueries({ queryKey: pollKey(token) });
      })
      .subscribe((status) => setSocket(socketFrom(status)));
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, initial.id, token, queryClient]);

  const read = useQuery({
    queryKey: [...pollKey(token), guestId],
    queryFn: () => readPoll(token, guestId),
    enabled,
    placeholderData: initial,
    // One retry, not three: a lost signal closes no socket, so a failing read is the quicker tell.
    retry: 1,
    refetchInterval: pollIntervalFor(socket),
  });

  return { poll: read.data ?? initial, reconnecting: socket === "dropped" || read.isError };
}
