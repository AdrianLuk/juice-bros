import type { MatchConfig, MatchEvent } from "@/components/apps/pickle-point-pal/lib/scoring/types";

/**
 * The single-match scratchpad.
 *
 * Every read and write goes through this module — no component touches
 * `window.localStorage` directly. A finished match is roughly 150 events, so
 * `JSON.stringify` is well under a millisecond and synchronous localStorage is
 * genuinely the right tool: no async ceremony, and the write completes before
 * the browser can unload the page.
 */
const KEY = "juicebros.picklepointpal.match";

/** Bump whenever MatchEvent or MatchConfig changes shape. Old saves are discarded, not migrated. */
const SCHEMA = 1;

export interface Persisted {
  schema: number;
  config: MatchConfig;
  events: MatchEvent[];
  savedAt: number;
}

export function save(config: MatchConfig, events: MatchEvent[]): void {
  if (typeof window === "undefined") return;
  try {
    const payload: Persisted = {
      schema: SCHEMA,
      config,
      events,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // Quota or private-mode failure. Losing autosave is survivable; throwing
    // mid-match is not.
  }
}

/**
 * Never throws. A corrupt save should start a fresh match, not white-screen a
 * ref mid-tournament. Call this from an effect, never during render — reading
 * storage while rendering causes a hydration mismatch.
 */
export function load(): Persisted | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    if (parsed?.schema !== SCHEMA) return null;
    if (!parsed.config || !Array.isArray(parsed.events)) return null;
    return parsed as Persisted;
  } catch {
    return null;
  }
}

/**
 * Which side of the net the ref is standing on, as a flip of the default
 * left/right assignment in the landscape layout.
 *
 * Kept out of the match record on purpose. It describes where a person is
 * standing, not something that happened in the game: undo must not be able to
 * reach it, and it is still true for the next match on the same court — so
 * `clear()` deliberately leaves it alone.
 */
const REF_FLIPPED_KEY = "juicebros.picklepointpal.refflipped";

export function loadRefFlipped(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(REF_FLIPPED_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveRefFlipped(flipped: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(REF_FLIPPED_KEY, flipped ? "1" : "0");
  } catch {
    // Same reasoning as save().
  }
}

export function clear(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Same reasoning as save().
  }
}
