"use client";

import { useState, useSyncExternalStore } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { vote } from "@/lib/mic-drop/actions/guest";
import { guestId } from "@/lib/mic-drop/guest-id";
import type { GuestPoll } from "@/lib/mic-drop/polls";
import { ChartView } from "./chart-view";
import { QueryProvider } from "./query-provider";
import { usePollSync } from "./use-poll-sync";

/**
 * A Guest Link's screen: the Poll as a weekly chart (direction contract,
 * .impeccable/surfaces/src-app-tools-mic-drop.md). Tap a row to make it this
 * phone's Vote, tap another to switch. Counts update live (issue #670).
 */
export function GuestBoard({ token, initial }: { token: string; initial: GuestPoll }) {
  return (
    <QueryProvider>
      <GuestChart token={token} initial={initial} />
    </QueryProvider>
  );
}

const SIGNAL_PROBLEM = "Your vote didn't save. Check your signal and tap again.";

const noSubscription = () => () => {};

/** This phone's Guest id: null on the server, kept in browser storage after. */
function useGuestId(): string | null {
  return useSyncExternalStore(noSubscription, guestId, () => null);
}

function GuestChart({ token, initial }: { token: string; initial: GuestPoll }) {
  const me = useGuestId();
  const queryClient = useQueryClient();

  const { poll, reconnecting } = usePollSync(token, initial, { guestId: me, enabled: me !== null });

  const [problem, setProblem] = useState<string | null>(null);
  const voting = useMutation({
    mutationFn: (contestantId: string) => vote(token, me!, contestantId),
    onSuccess: (outcome) => {
      setProblem(outcome.ok ? null : outcome.problem);
      void queryClient.invalidateQueries({ queryKey: ["mic-drop", "poll", token] });
    },
    onError: () => setProblem(SIGNAL_PROBLEM),
  });

  // A closed Poll's rows do nothing: the footer already says voting's closed.
  function tap(contestantId: string) {
    setProblem(null);
    if (!poll.open || me === null || voting.isPending || contestantId === poll.myVote) return;
    voting.mutate(contestantId);
  }

  return (
    <ChartView
      poll={poll}
      reconnecting={reconnecting}
      problem={problem}
      saving={voting.isPending ? voting.variables : null}
      onTap={tap}
    />
  );
}
