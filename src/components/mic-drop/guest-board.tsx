"use client";

import { useState, useSyncExternalStore } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { unvote, vote } from "@/lib/mic-drop/actions/guest";
import { guestId } from "@/lib/mic-drop/guest-id";
import type { GuestPoll } from "@/lib/mic-drop/polls";
import { ChartView } from "./chart-view";
import { QueryProvider } from "./query-provider";
import { usePollSync } from "./use-poll-sync";

/**
 * A Guest Link's screen: the Poll as a weekly chart (direction contract,
 * .impeccable/surfaces/src-app-tools-mic-drop.md). Tap a row to make it this
 * phone's Vote, tap another to switch, tap it again to take it back (#671).
 * Counts update live (issue #670).
 */
export function GuestBoard({ token, initial }: { token: string; initial: GuestPoll }) {
  return (
    <QueryProvider>
      <GuestChart token={token} initial={initial} />
    </QueryProvider>
  );
}

const SIGNAL_PROBLEM = "Your vote didn't save. Check your signal and tap again.";
const CLOSED_TAP = "Voting's closed, so that tap didn't count.";
const PICK_REMOVED = "Your pick was taken off the line-up, so you have no vote. Tap a name to pick again.";

const noSubscription = () => () => {};

/** This phone's Guest id: null on the server, kept in browser storage after. */
function useGuestId(): string | null {
  return useSyncExternalStore(noSubscription, guestId, () => null);
}

function GuestChart({ token, initial }: { token: string; initial: GuestPoll }) {
  const me = useGuestId();
  const queryClient = useQueryClient();

  const { poll, reconnecting } = usePollSync(token, initial, { guestId: me, enabled: me !== null });

  // A pick that vanished from the line-up was removed by the Host: say so, until the next pick.
  const [lastPick, setLastPick] = useState(poll.myVote);
  const [pickRemoved, setPickRemoved] = useState(false);
  if (poll.myVote !== lastPick) {
    setLastPick(poll.myVote);
    setPickRemoved(
      lastPick !== null && poll.myVote === null && !poll.contestants.some((contestant) => contestant.id === lastPick),
    );
  }

  const [problem, setProblem] = useState<string | null>(null);
  const voting = useMutation({
    // null takes this phone's Vote back.
    mutationFn: (contestantId: string | null) =>
      contestantId === null ? unvote(token, me!) : vote(token, me!, contestantId),
    onSuccess: (outcome) => {
      setProblem(outcome.ok ? null : outcome.problem);
      void queryClient.invalidateQueries({ queryKey: ["mic-drop", "poll", token] });
    },
    onError: () => setProblem(SIGNAL_PROBLEM),
  });

  // Your own pick again takes it back; a closed Poll says why the tap did nothing.
  function tap(contestantId: string) {
    setProblem(poll.open ? null : CLOSED_TAP);
    if (!poll.open || me === null || voting.isPending) return;
    voting.mutate(contestantId === poll.myVote ? null : contestantId);
  }

  return (
    <ChartView
      poll={poll}
      reconnecting={reconnecting}
      problem={problem ?? (pickRemoved ? PICK_REMOVED : null)}
      saving={voting.isPending ? (voting.variables ?? poll.myVote) : null}
      onTap={tap}
    />
  );
}
