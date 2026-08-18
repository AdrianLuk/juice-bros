/**
 * Pure logic for a User's own Gender (issue #79).
 *
 * Optional and self-reported, unlike Username — there's no format to reject
 * a bad value against, so a value that isn't a real `Gender` just becomes
 * `null` (unset) rather than an error, the same "default rather than error"
 * posture `capacity.ts`'s own format parsing already takes for a stray or
 * tampered value. The form itself only ever offers three real choices
 * (unset/male/female), so this only matters for a stale or hand-built request.
 *
 * Kept free of Next.js and Supabase imports so it can be unit tested directly.
 */

export type Gender = "male" | "female";

export const GENDERS: readonly Gender[] = ["male", "female"];

export function isGender(value: unknown): value is Gender {
  return GENDERS.includes(value as Gender);
}

export const GENDER_LABEL: Record<Gender, string> = {
  male: "Male",
  female: "Female",
};

/** A blank string (the "Prefer not to say" choice) parses to `null`, not an error — unset is a first-class state. */
export function parseGender(raw: string): Gender | null {
  const trimmed = raw.trim().toLowerCase();
  return isGender(trimmed) ? trimmed : null;
}
