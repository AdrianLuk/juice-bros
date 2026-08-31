import type {
  CourtSlot,
  RosterPlayer,
  SessionConfig,
  SessionEvent,
  SessionState,
} from "./types.ts";

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

/**
 * Seat the longest-waiting Foursome from the Queue onto one freed Court
 * (ADR 0004). Naive selection for #243 — the four at the front of the Queue
 * walk on. Fewer than four waiting: the Court stays empty until there are.
 *
 * Only ever fills the Court named by a `COURT_FINISHED` event, one at a time,
 * so several finishing together fold sequentially with the Foursome removed
 * from the Queue before the next Court is filled.
 */
function seatCourt(state: SessionState, court: CourtSlot, at: number): void {
  if (state.queue.length < 4) return;
  const four = state.queue.splice(0, 4);
  court.foursome = four.map((e) => e.playerId);
  court.since = at;
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
 * Selection tie-breaks (arriving in later tickets) derive from
 * `config.seed`, never from `Math.random()`, for the same reason.
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
        break;
      }

      case "COURT_FINISHED": {
        if (state.status !== "open") break;
        const court = state.courts.find((c) => c.number === event.court);
        if (!court) break;

        // The four coming off re-queue automatically, Wait Time measured from
        // this event (CONTEXT: "or from the moment they last came off a Court,
        // whichever is later").
        for (const playerId of court.foursome) {
          state.queue.push({ playerId, waitSince: event.at });
        }
        court.foursome = [];
        court.since = null;
        sortQueue(state.queue);

        // ...then the longest-waiting Foursome walks onto the freed Court.
        seatCourt(state, court, event.at);
        break;
      }
    }
  }

  return state;
}
