/**
 * The landing page's demo Poll: a made-up karaoke night that runs entirely in
 * the browser. The visitor's taps are one phone (tap to vote, another to
 * switch, the same one again to take it back); a made-up crowd votes and
 * switches around them, so the chart re-sorts the way it does on the night.
 * Nothing touches the database. Pure, for `node --test`.
 */

import type { GuestPoll } from "./polls.ts";

/** In entry order. PPA Tour pros, since this repo is public; a duet is one Contestant. */
export const DEMO_LINE_UP = [
  { id: "anna-leigh-waters", name: "Anna Leigh Waters" },
  { id: "ben-johns", name: "Ben Johns" },
  { id: "jw-dylan", name: "JW Johnson & Dylan Frazier" },
  { id: "catherine-parenteau", name: "Catherine Parenteau" },
  { id: "tyson-mcguffin", name: "Tyson McGuffin" },
  { id: "anna-bright", name: "Anna Bright" },
  { id: "federico-staksrud", name: "Federico Staksrud" },
] as const;

export const DEMO_POLL_NAME = "Karaoke night";

/** The made-up room stops filling here; after that it only switches. */
export const DEMO_ROOM_SIZE = 24;

/** How hard the crowd leans on each Contestant, in entry order: close enough at the top to swap the lead. */
const CROWD_LEAN = [5, 5, 4, 3, 2, 2, 1];

export type DemoState = {
  open: boolean;
  /** Every Vote, the visitor's included. */
  votes: Record<string, number>;
  phonesIn: number;
  /** The visitor's Contestant, or null before their first tap. */
  myVote: string | null;
};

export type DemoEvent =
  | { kind: "tap"; contestantId: string }
  /** A crowd phone votes: a new phone when `from` is null, a switch otherwise. */
  | { kind: "crowd"; to: string; from: string | null }
  | { kind: "close" }
  | { kind: "reopen" }
  | { kind: "restart" };

export function demoStart(): DemoState {
  const opening = [4, 3, 3, 1, 1, 0, 0];
  return {
    open: true,
    votes: Object.fromEntries(DEMO_LINE_UP.map((contestant, index) => [contestant.id, opening[index]])),
    phonesIn: opening.reduce((sum, count) => sum + count, 0),
    myVote: null,
  };
}

function moveVote(votes: Record<string, number>, to: string, from: string | null): Record<string, number> {
  const next = { ...votes, [to]: votes[to] + 1 };
  if (from !== null) next[from] -= 1;
  return next;
}

export function demoReduce(state: DemoState, event: DemoEvent): DemoState {
  switch (event.kind) {
    case "tap":
      if (!state.open || !(event.contestantId in state.votes)) return state;
      // Your own pick again: take it back.
      if (event.contestantId === state.myVote) {
        return {
          ...state,
          votes: { ...state.votes, [state.myVote]: state.votes[state.myVote] - 1 },
          phonesIn: state.phonesIn - 1,
          myVote: null,
        };
      }
      return {
        ...state,
        votes: moveVote(state.votes, event.contestantId, state.myVote),
        phonesIn: state.myVote === null ? state.phonesIn + 1 : state.phonesIn,
        myVote: event.contestantId,
      };
    case "crowd":
      if (!state.open) return state;
      return {
        ...state,
        votes: moveVote(state.votes, event.to, event.from),
        phonesIn: event.from === null ? state.phonesIn + 1 : state.phonesIn,
      };
    case "close":
      return { ...state, open: false };
    case "reopen":
      return { ...state, open: true };
    case "restart":
      return demoStart();
  }
}

/** A pick weighted by `weights`, from a random number in [0, 1). */
function weighted(ids: string[], weights: number[], random: number): string | null {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) return null;
  let roll = random * total;
  for (const [index, id] of ids.entries()) {
    roll -= weights[index];
    if (roll < 0) return id;
  }
  return ids.at(-1) ?? null;
}

/**
 * The crowd's next move: a new phone while the room is filling, otherwise
 * someone switching away from a Contestant they'd backed. Never touches the
 * visitor's own Vote. Null on a closed Poll.
 */
export function crowdMove(state: DemoState, random: () => number): DemoEvent | null {
  if (!state.open) return null;
  const ids = DEMO_LINE_UP.map((contestant) => contestant.id);
  if (state.phonesIn < DEMO_ROOM_SIZE && random() < 0.6) {
    return { kind: "crowd", to: weighted(ids, CROWD_LEAN, random())!, from: null };
  }
  const crowdVotes = ids.map((id) => state.votes[id] - (id === state.myVote ? 1 : 0));
  const from = weighted(ids, crowdVotes, random());
  if (from === null) return null;
  const to = weighted(ids, CROWD_LEAN.map((lean, index) => (ids[index] === from ? 0 : lean)), random());
  return to === null ? null : { kind: "crowd", to, from };
}

/** The demo as the chart reads it: most Votes first, entry order breaking ties, joint winners once closed. */
export function demoPoll(state: DemoState): GuestPoll {
  const contestants = DEMO_LINE_UP.map((contestant) => ({ ...contestant, votes: state.votes[contestant.id] }))
    .map((contestant, position) => ({ contestant, position }))
    .toSorted((a, b) => b.contestant.votes - a.contestant.votes || a.position - b.position)
    .map(({ contestant }) => contestant);
  const top = contestants[0]?.votes ?? 0;
  return {
    id: "demo",
    name: DEMO_POLL_NAME,
    open: state.open,
    phonesIn: state.phonesIn,
    contestants,
    myVote: state.myVote,
    winnerIds:
      state.open || top === 0
        ? []
        : DEMO_LINE_UP.filter((contestant) => state.votes[contestant.id] === top).map((contestant) => contestant.id),
  };
}
