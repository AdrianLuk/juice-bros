/**
 * The Player's device token — their whole identity for one Session (ADR 0001).
 *
 * Minted and kept in `localStorage`, keyed by Session id: reopening the Club
 * QR on the same device finds the same token, the roster already carries it,
 * and the Player sees "you're already in" instead of the setup form. Nothing
 * here outlives the Session or crosses to another device.
 *
 * Every access is guarded — private-mode and disabled-storage browsers throw
 * on `localStorage`, and losing the token just means the Player re-does setup.
 */
const KEY_PREFIX = "juicebros.on-deck.player.";

function keyFor(sessionId: string): string {
  return `${KEY_PREFIX}${sessionId}`;
}

export function loadPlayerToken(sessionId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(keyFor(sessionId));
  } catch {
    return null;
  }
}

export function savePlayerToken(sessionId: string, token: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(keyFor(sessionId), token);
  } catch {
    // No persistence available (private mode, storage disabled). The join
    // itself still succeeded and the "you're in" screen holds for this tab;
    // but a full reload would mint a fresh token and re-join as a new roster
    // entry. Rare enough at a walk-up social to accept under ADR 0001's
    // device-only identity model — the alternative is an account.
  }
}

/** A fresh token. `randomUUID` is available in every browser we target. */
export function newPlayerToken(): string {
  return crypto.randomUUID();
}
