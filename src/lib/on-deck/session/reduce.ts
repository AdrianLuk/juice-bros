import type {
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
 */
export function reduceSession(
  config: SessionConfig,
  events: SessionEvent[],
): SessionState {
  const state: SessionState = {
    config,
    startedAt: null,
    startedBy: null,
    status: "pending",
    roster: [],
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
    }
  }

  return state;
}
