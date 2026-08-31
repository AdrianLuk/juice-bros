import { selectFoursome } from "./match-me.ts";
import type {
  CourtSlot,
  OnDeckFoursome,
  RosterPlayer,
  SessionConfig,
  SessionEvent,
  SessionState,
  SkillLevel,
} from "./types.ts";

/** How many Foursomes On Deck holds ahead of a Court freeing — "Up next" and
 * "After that" (issue #245). */
const ON_DECK_DEPTH = 2;

/** A Foursome is playable — walks straight onto a Court — only when full. */
function isComplete(foursome: OnDeckFoursome): boolean {
  return foursome.players.length === 4;
}

/** Trim, collapse inner whitespace, capitalise the first letter. */
function cleanFirstName(raw: string): string {
  const s = raw.trim().replace(/\s+/g, " ");
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/** The first letter of the input, upper-cased; "" if there is none. */
function cleanLastInitial(raw: string): string {
  const letter = raw.trim().match(/[a-z]/i);
  return letter ? letter[0].toUpperCase() : "";
}

/**
 * "First name + last initial", plus a numeric suffix when a Player with the
 * same name and initial has already joined — "Sarah K.", then "Sarah K. 2".
 * The comparison is case- and whitespace-insensitive so "sarah" and "Sarah"
 * collide.
 */
function displayNameFor(
  firstName: string,
  lastInitial: string,
  roster: RosterPlayer[],
): string {
  const base = `${firstName} ${lastInitial}.`;
  const priorSameName = roster.filter(
    (p) =>
      p.firstName.toLowerCase() === firstName.toLowerCase() &&
      p.lastInitial.toLowerCase() === lastInitial.toLowerCase(),
  ).length;
  return priorSameName === 0 ? base : `${base} ${priorSameName + 1}`;
}

/**
 * Re-sort the Queue longest-wait-first. `Array.prototype.sort` is stable, so
 * Players who began waiting at the same instant — the four coming off a Court
 * together — keep the order they were added in.
 */
function sortQueue(queue: SessionState["queue"]): void {
  queue.sort((a, b) => a.waitSince - b.waitSince);
}

/** A Player's declared Skill Level, defaulting to intermediate for a token the
 * roster somehow lacks. */
function skillLookup(state: SessionState): (id: string) => SkillLevel {
  const byId = new Map<string, SkillLevel>(
    state.roster.map((p) => [p.id, p.skillLevel]),
  );
  return (id) => byId.get(id) ?? "intermediate";
}

/**
 * Run Match Me (`match-me.ts`, ADR 0004) over a list of waiting Players, already
 * in wait order: the longest-waiting anchors, the other three are the best
 * Skill / Variety fit from a window of the next-longest-waiting. `null` when
 * fewer than four are given.
 */
function pickFoursome(state: SessionState, waiting: string[]): string[] | null {
  return selectFoursome({
    queue: waiting,
    skillOf: skillLookup(state),
    completedGames: state.completedGames,
    seed: state.config.seed,
  });
}

/**
 * Seat a Foursome onto one freed Court. The committed "Up next" Foursome
 * (issue #245) walks straight on when it is complete and still entirely in the
 * Queue; otherwise Match Me picks from the Queue directly. Fewer than four to
 * seat either way: the Court stays empty until there are.
 *
 * Only ever fills the Court named by a `COURT_FINISHED` event, one at a time,
 * so several finishing together fold sequentially with the Foursome removed
 * from the Queue before the next Court is filled.
 */
function seatCourt(state: SessionState, court: CourtSlot, at: number): void {
  const queuedIds = new Set(state.queue.map((e) => e.playerId));

  let foursome: string[] | null = null;
  const lead = state.onDeck[0];
  if (lead && isComplete(lead) && lead.players.every((id) => queuedIds.has(id))) {
    foursome = lead.players;
    state.onDeck.shift();
  } else {
    foursome = pickFoursome(state, state.queue.map((e) => e.playerId));
  }
  if (!foursome) return;

  const seated = new Set(foursome);
  state.queue = state.queue.filter((e) => !seated.has(e.playerId));
  court.foursome = foursome;
  court.since = at;
}

/**
 * Bring On Deck back up to `ON_DECK_DEPTH` committed Foursomes after any event
 * that changed the Queue (issue #245). The rules, in order:
 *
 *   1. **Never reshuffle.** An already-committed Foursome keeps its members;
 *      this function only drops Players who have left the Queue, tops up
 *      incomplete Foursomes, and forms new ones.
 *   2. **Top up in wait order.** An incomplete Foursome (short Queue when it
 *      formed) gains the next-longest-waiting unspoken-for Players until full.
 *   3. **Form with Match Me.** A fresh Foursome is selected via `pickFoursome`
 *      from the Players not already spoken for by On Deck or a Court. The
 *      *first* Foursome only forms once four are available — a lone waiter is
 *      "in the Queue", not "on deck". A *second* Foursome may form with as few
 *      as one, so "After that" fills out as Players arrive.
 */
function refreshOnDeck(state: SessionState, at: number): void {
  const queuedIds = new Set(state.queue.map((e) => e.playerId));

  // 1. A committed Player who is no longer waiting (walked onto a Court) drops
  //    out; a Foursome emptied that way is gone.
  for (const foursome of state.onDeck) {
    foursome.players = foursome.players.filter((id) => queuedIds.has(id));
  }
  state.onDeck = state.onDeck.filter((f) => f.players.length > 0);

  const spokenFor = new Set(state.onDeck.flatMap((f) => f.players));
  const available = state.queue
    .map((e) => e.playerId)
    .filter((id) => !spokenFor.has(id));

  // 2. Top up incomplete Foursomes, "Up next" before "After that".
  for (const foursome of state.onDeck) {
    while (foursome.players.length < 4 && available.length > 0) {
      foursome.players.push(available.shift()!);
    }
  }

  // 3. Form new Foursomes until On Deck is `ON_DECK_DEPTH` deep or nobody is
  //    left to commit. The first needs a full four; a second may start partial.
  while (state.onDeck.length < ON_DECK_DEPTH) {
    const minSize = state.onDeck.length === 0 ? 4 : 1;
    if (available.length < minSize) break;
    const picked = pickFoursome(state, available) ?? [...available];
    const seated = new Set(picked);
    for (let i = available.length - 1; i >= 0; i--) {
      if (seated.has(available[i])) available.splice(i, 1);
    }
    state.onDeck.push({ players: picked, committedAt: at });
  }
}

/**
 * The pure fold. Takes the whole event array — not one event at a time —
 * because that is what makes replay (and therefore undo) trivial: undo is
 * dropping the last event and re-folding, never a compensating action.
 *
 * `reduceSession` must NEVER call `Date.now()`. It reads `at` off each event.
 * Whether anything has *elapsed* since is a question for the render layer,
 * which has a ticking clock. The moment this function reads the wall clock,
 * `reduceSession(config, events)` stops being reproducible and the
 * undo-parity guarantee goes with it.
 *
 * Match Me's selection tie-breaks derive from `config.seed`, never
 * `Math.random()`, for the same reason (see `match-me.ts`).
 *
 * A `COURT_FINISHED` on an already-empty Court carries no Game — it just seats
 * the next Foursome (the floor screen's "Send next four" on session start).
 * "Games played" for the Session Summary is therefore a count of
 * `COURT_FINISHED` events whose Court *was* occupied, derived in a later fold,
 * not a raw event count.
 */
export function reduceSession(
  config: SessionConfig,
  events: SessionEvent[],
): SessionState {
  const courts: CourtSlot[] = Array.from(
    { length: Math.max(0, config.courtCount) },
    (_, i) => ({ number: i + 1, foursome: [], since: null }),
  );

  const state: SessionState = {
    config,
    startedAt: null,
    startedBy: null,
    status: "pending",
    roster: [],
    queue: [],
    courts,
    onDeck: [],
    completedGames: [],
  };

  for (const event of events) {
    switch (event.type) {
      case "SESSION_STARTED": {
        // The log should only ever carry one, but a replayed duplicate must
        // not move the start time or reassign the Operator.
        if (state.status !== "pending") break;
        state.startedAt = event.at;
        state.startedBy = event.operator;
        state.status = "open";
        break;
      }

      case "PLAYER_JOINED": {
        // A Player can only join a running Session; a stray join before the
        // Session opens is ignored rather than folded.
        if (state.status !== "open") break;
        // Reopening the Club QR on the same device replays the same token —
        // that must not add a second roster entry (and must not overwrite the
        // first: the earliest join wins).
        if (state.roster.some((p) => p.id === event.token)) break;

        const firstName = cleanFirstName(event.firstName);
        const lastInitial = cleanLastInitial(event.lastInitial);
        state.roster.push({
          id: event.token,
          firstName,
          lastInitial,
          skillLevel: event.skillLevel,
          displayName: displayNameFor(firstName, lastInitial, state.roster),
          joinedAt: event.at,
        });
        break;
      }

      case "PLAYER_QUEUED": {
        if (state.status !== "open") break;
        // Unknown token, or a Player already waiting or on a Court — a replayed
        // or stray queue tap is a no-op, not a second entry.
        if (!state.roster.some((p) => p.id === event.token)) break;
        if (state.queue.some((e) => e.playerId === event.token)) break;
        if (state.courts.some((c) => c.foursome.includes(event.token))) break;

        // Naive selection stands in for Match Me here (#243): a queued Player
        // waits until a Court is tapped done. The fold does not pull them onto
        // an empty Court — that only happens on `COURT_FINISHED`, so a Player
        // reliably "joins the Queue and sees their position".
        state.queue.push({ playerId: event.token, waitSince: event.at });
        sortQueue(state.queue);

        // The new waiter fills out an incomplete On Deck Foursome, or forms one
        // — but never reshuffles a Foursome already announced (issue #245).
        refreshOnDeck(state, event.at);
        break;
      }

      case "COURT_FINISHED": {
        if (state.status !== "open") break;
        const court = state.courts.find((c) => c.number === event.court);
        if (!court) break;

        // A real Game (an occupied Court) ending is the Variety history Match
        // Me scores against; an empty Court tapped done carries no Game.
        if (court.foursome.length > 0) {
          state.completedGames.push({ players: [...court.foursome] });
        }

        // The four coming off re-queue automatically, Wait Time measured from
        // this event (CONTEXT: "or from the moment they last came off a Court,
        // whichever is later").
        for (const playerId of court.foursome) {
          state.queue.push({ playerId, waitSince: event.at });
        }
        court.foursome = [];
        court.since = null;
        sortQueue(state.queue);

        // ...then the "Up next" On Deck Foursome (or Match Me, if it is not
        // ready) walks onto the freed Court, and On Deck refills behind it.
        seatCourt(state, court, event.at);
        refreshOnDeck(state, event.at);
        break;
      }
    }
  }

  return state;
}
