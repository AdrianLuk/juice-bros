/**
 * The Organizer Link of the last board this browser took live (#687), so
 * closing the tab doesn't lose control of the night. Its own key, a schema
 * marker, an SSR guard and try/catch on both sides, like `selection-storage`.
 *
 * shortcut: one slot, the latest Live Mixer only; My Mixers (#685 slice 6)
 * lists every one for an organizer who signs in.
 */

const KEY = "juicebros.matchmixer.live";

/** Bump whenever the saved shape changes. Old saves are discarded, not migrated. */
const SCHEMA = 1;

export interface RememberedLive {
  readonly organizerPath: string;
  readonly playerPath: string;
  /** ISO time it went live, for saying which night it was. */
  readonly wentLiveAt: string;
}

const ORGANIZER_PATH = /^\/tools\/match-mixer\/organizer\/[0-9a-f]{24,128}$/;
const PLAYER_PATH = /^\/tools\/match-mixer\/player\/[0-9a-f]{24,128}$/;

export function remember(live: RememberedLive): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ schema: SCHEMA, ...live }));
  } catch {
    // Quota or private mode: the Organizer Link is still on screen to copy.
  }
}

/** The remembered Live Mixer, or null for nothing, a corrupt value or a refused read. Call from an effect. */
export function recall(): RememberedLive | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const { schema, organizerPath, playerPath, wentLiveAt } = parsed as Record<string, unknown>;
    if (schema !== SCHEMA) return null;
    if (typeof organizerPath !== "string" || !ORGANIZER_PATH.test(organizerPath)) return null;
    if (typeof playerPath !== "string" || !PLAYER_PATH.test(playerPath)) return null;
    if (typeof wentLiveAt !== "string" || Number.isNaN(Date.parse(wentLiveAt))) return null;
    return { organizerPath, playerPath, wentLiveAt };
  } catch {
    return null;
  }
}
