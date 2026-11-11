/**
 * The Guest id: a random id this browser makes on its first visit and keeps,
 * so one phone is one Vote (mic-drop/CONTEXT.md, "Guest"). A private tab or
 * cleared storage counts as a new phone, and that's accepted (spec #666).
 *
 * Browser only. When storage is blocked, the id lives for this page view
 * only: the Guest can still vote, but a reload is a new phone.
 */

const KEY = "mic-drop:guest-id";

let fallback: string | null = null;

export function guestId(): string {
  try {
    const kept = window.localStorage.getItem(KEY);
    if (kept) return kept;
    const made = crypto.randomUUID();
    window.localStorage.setItem(KEY, made);
    return made;
  } catch {
    fallback ??= crypto.randomUUID();
    return fallback;
  }
}
