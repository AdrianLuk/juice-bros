import type { RaffleEvent } from "../engine/types.ts";

/**
 * The night, kept in this browser.
 *
 * Only the log is stored, never the folded state: the state is a pure function
 * of the log, so storing both would be storing the same night twice and
 * inviting them to disagree.
 *
 * Written on every event rather than debounced, unlike Match Mixer's Config.
 * That module is absorbing keystrokes; this one is absorbing a handful of
 * deliberate taps across an evening, and the failure it exists to prevent —
 * a pocketed phone, a closed tab, a flat battery halfway through the prizes —
 * is exactly the one a debounce window would let through.
 */
const KEY = "juicebros.drumroll.log";

/** Bump whenever the event shape changes. Old saves are discarded, not migrated. */
const SCHEMA = 1;

const EVENT_TYPES = new Set<RaffleEvent["type"]>([
  "ENTRANT_ADDED",
  "TICKETS_SET",
  "ENTRANT_REMOVED",
  "PRIZE_ADDED",
  "PRIZE_REMOVED",
  "DRAWN",
  "REDRAWN",
  "ONE_PRIZE_PER_PERSON_SET",
]);

interface SavedNight {
  readonly schema: number;
  readonly events: readonly RaffleEvent[];
}

export function load(): RaffleEvent[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as SavedNight;
    if (parsed?.schema !== SCHEMA || !Array.isArray(parsed.events)) return [];

    // Anything unrecognised is dropped rather than trusted. A log is only
    // useful if the fold can read all of it, and a half-understood night is
    // worse than a fresh one.
    return parsed.events.filter(
      (event): event is RaffleEvent =>
        typeof event?.type === "string" &&
        EVENT_TYPES.has(event.type as RaffleEvent["type"]),
    );
  } catch {
    // A private window, cleared site data, or a half-written value. Start the
    // night rather than break the screen.
    return [];
  }
}

export function save(events: readonly RaffleEvent[]): void {
  if (typeof window === "undefined") return;

  try {
    const night: SavedNight = { schema: SCHEMA, events };
    window.localStorage.setItem(KEY, JSON.stringify(night));
  } catch {
    // Storage full or blocked. The night carries on in memory; losing the
    // restore is bad, losing the draw in hand would be worse.
  }
}

export function clear(): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing to do, and nothing worth interrupting the organizer over.
  }
}
