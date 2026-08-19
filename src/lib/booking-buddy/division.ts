/**
 * Pure logic for a Slot's Division (issue #80) — which gender composition its
 * Capacity signal gets broken down by. Not organizer-configurable per side:
 * `mixed` is always a fixed even split between male and female, decided
 * while scoping this ticket.
 *
 * `open` is the default, and the only value every Slot had before this
 * ticket — its whole point is to keep today's plain, ungendered count
 * unchanged (see `capacity.ts`'s `computeGenderedCapacity`).
 *
 * Kept free of Next.js and Supabase imports so it can be unit tested directly.
 */

export type Division = "open" | "mixed" | "mens" | "womens";

export const DIVISIONS: readonly Division[] = ["open", "mixed", "mens", "womens"];

export const DEFAULT_DIVISION: Division = "open";

export function isDivision(value: unknown): value is Division {
  return DIVISIONS.includes(value as Division);
}

export const DIVISION_LABEL: Record<Division, string> = {
  open: "Open",
  mixed: "Mixed",
  mens: "Men's",
  womens: "Women's",
};

/**
 * A stray or tampered value falls back to `open` rather than an error — the
 * same "default rather than error" posture `capacity.ts`'s own format
 * parsing takes for a stray value (see `parseNewBooking`). Unlike Gender,
 * there's no "unset" state to preserve: every Slot has a Division, and the
 * safe default is the one that changes nothing.
 */
export function parseDivision(raw: string): Division {
  const trimmed = raw.trim().toLowerCase();
  return isDivision(trimmed) ? trimmed : DEFAULT_DIVISION;
}
