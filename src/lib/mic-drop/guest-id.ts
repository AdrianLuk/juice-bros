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
    const made = randomId();
    window.localStorage.setItem(KEY, made);
    return made;
  } catch {
    fallback ??= randomId();
    return fallback;
  }
}

/** A version 4 UUID. Older in-app browsers lack `crypto.randomUUID` but have `getRandomValues`. */
function randomId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
