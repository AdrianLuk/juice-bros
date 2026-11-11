"use client";

import { useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { readPoll, vote } from "@/lib/mic-drop/actions/guest";
import { guestId } from "@/lib/mic-drop/guest-id";
import { barShare, chartRanks, nextChart, type ChartState, type Movement } from "@/lib/mic-drop/leaderboard";
import type { GuestPoll } from "@/lib/mic-drop/polls";
import { cn } from "@/lib/utils";
import { QueryProvider } from "./query-provider";

/**
 * A Guest Link's screen: the Poll as a weekly chart (direction contract,
 * .impeccable/surfaces/src-app-tools-mic-drop.md). Tap a row to make it this
 * phone's Vote, tap another to switch. Counts are current as of the last read;
 * the live broadcast arrives with #670.
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

  const { data } = useQuery({
    queryKey: ["mic-drop", "poll", token, me],
    queryFn: () => readPoll(token, me),
    enabled: me !== null,
    placeholderData: initial,
  });
  const poll = data ?? initial;

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

  // Movement marks against what this phone last showed, held until the next change.
  const order = poll.contestants.map((contestant) => contestant.id);
  const [chart, setChart] = useState<ChartState>(() => nextChart(null, order));
  const current = nextChart(chart, order);
  if (current !== chart) setChart(current);

  const rows = useRowSlide(order.join(","));
  const ranks = chartRanks(poll.contestants);
  const leaderVotes = poll.contestants[0]?.votes ?? 0;
  const tied = (rank: number | null) =>
    rank !== null && Object.values(ranks).filter((other) => other === rank).length > 1;

  const winners = poll.contestants.filter((contestant) => poll.winnerIds.includes(contestant.id));
  const myPick = poll.contestants.find((contestant) => contestant.id === poll.myVote);
  const saving = voting.isPending ? voting.variables : null;

  return (
    <div className="flex w-full flex-1 flex-col">
      <header className={cn("md-field", !poll.open && "is-final")}>
        <div className="md-col">
          <h1>{poll.name}</h1>
          <div className="md-field-meta">
            <span className="md-live">{poll.open ? "Live chart" : "Final chart"}</span>
            <span>
              {poll.phonesIn} {poll.phonesIn === 1 ? "phone" : "phones"} in
            </span>
          </div>
        </div>
      </header>

      {winners.length > 0 && (
        <section className="md-top md-col" aria-label={winners.length > 1 ? "Joint winners" : "Winner"}>
          <div className="md-top-label">{winners.length > 1 ? "No. 1 · joint winners" : "No. 1"}</div>
          <ul className="md-top-names">
            {winners.map((winner) => (
              <li key={winner.id}>{winner.name}</li>
            ))}
          </ul>
          <p>
            {winners.length > 1
              ? `${winners[0].votes} votes each. Settle it with a sing-off.`
              : `${winners[0].votes} ${winners[0].votes === 1 ? "vote" : "votes"}.`}
          </p>
        </section>
      )}

      {poll.contestants.length === 0 ? (
        <p className="md-empty md-col">No Contestants yet. The Host is still typing in the line-up.</p>
      ) : (
        <ol className="md-chart md-col" aria-label="Leaderboard">
          {poll.contestants.map((contestant) => {
            const rank = ranks[contestant.id];
            const mine = contestant.id === poll.myVote;
            return (
              <li key={contestant.id} ref={rows(contestant.id)}>
                <button
                  type="button"
                  className={cn("md-row", rank === 1 && "is-top", saving === contestant.id && "is-saving")}
                  aria-pressed={mine}
                  aria-disabled={!poll.open || undefined}
                  aria-label={`${contestant.name}, ${contestant.votes} ${contestant.votes === 1 ? "vote" : "votes"}${
                    rank === null ? "" : `, rank ${rank}`
                  }${movementWords(current.marks[contestant.id])}${mine ? ", your vote" : ""}`}
                  onClick={() => tap(contestant.id)}
                >
                  <span className="md-rank">
                    <b className={rank === null ? "is-unranked" : undefined}>
                      {rank === null ? "–" : `${tied(rank) ? "=" : ""}${rank}`}
                    </b>
                    {/* An unranked row's dash already says "nothing yet"; a second one for "no change" is noise. */}
                    {(rank !== null || current.marks[contestant.id]?.kind === "new") && (
                      <MovementMark movement={current.marks[contestant.id]} />
                    )}
                  </span>
                  <span className="md-name">
                    {contestant.name}
                    {mine && <span className="md-mine-chip">Your vote</span>}
                  </span>
                  <span className="md-count">{contestant.votes}</span>
                  <span className="md-bar" aria-hidden>
                    <i style={{ transform: `scaleX(${barShare(contestant.votes, leaderVotes)})` }} />
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}

      <footer className="md-foot" aria-live="polite">
        <div className="md-col">
          {problem ? (
            <span className="is-problem">{problem}</span>
          ) : !poll.open ? (
            <>
              <b>Voting&apos;s closed.</b> This is the final result.
            </>
          ) : myPick ? (
            <>
              <b>Your vote: {myPick.name}.</b> Tap another name to switch.
            </>
          ) : (
            <>
              <b>Tap a name to vote.</b> Tap another to switch.
            </>
          )}
        </div>
      </footer>
    </div>
  );
}

function MovementMark({ movement }: { movement: Movement | undefined }) {
  if (!movement || movement.kind === "same") {
    return (
      <span className="md-move is-same">
        <span className="sr-only">no change</span>
      </span>
    );
  }
  if (movement.kind === "new") return <span className="md-move is-new">New</span>;
  return (
    <span className={cn("md-move", movement.kind === "up" ? "is-up" : "is-down")}>
      {movement.kind === "up" ? "▲" : "▼"} {movement.by}
    </span>
  );
}

/**
 * The signature interaction: when the chart re-sorts, each row slides from
 * where it was to its new place (FLIP). Reduced motion cuts to the new order.
 * Returns a ref callback per row id.
 */
function useRowSlide(orderKey: string) {
  const elements = useRef(new Map<string, HTMLElement>());
  const refs = useRef(new Map<string, (element: HTMLElement | null) => () => void>());
  const lastTops = useRef(new Map<string, number>());
  const lastOrder = useRef(orderKey);

  // Measure after every commit, so a layout shift that isn't a re-sort (the
  // winners block appearing, a chip wrapping, a rotation) never leaves stale
  // positions behind; slide only when the order itself changed.
  useLayoutEffect(() => {
    const resorted = lastOrder.current !== orderKey;
    lastOrder.current = orderKey;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tops = new Map<string, number>();
    for (const [id, element] of elements.current) {
      const top = element.offsetTop;
      tops.set(id, top);
      const was = lastTops.current.get(id);
      if (resorted && !reduce && was !== undefined && was !== top) {
        element.animate([{ transform: `translateY(${was - top}px)` }, { transform: "none" }], {
          duration: 450,
          easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
        });
      }
    }
    lastTops.current = tops;
  });

  // One stable ref callback per row, so a render doesn't detach and reattach every row.
  return (id: string) => {
    let ref = refs.current.get(id);
    if (!ref) {
      ref = (element: HTMLElement | null) => {
        if (element) elements.current.set(id, element);
        return () => {
          elements.current.delete(id);
        };
      };
      refs.current.set(id, ref);
    }
    return ref;
  };
}

function movementWords(movement: Movement | undefined): string {
  if (!movement || movement.kind === "same") return "";
  if (movement.kind === "new") return ", new";
  return `, ${movement.kind} ${movement.by}`;
}
