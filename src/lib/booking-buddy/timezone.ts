/**
 * Time zone logic shared by Orgs and Bookings — free of Next.js and Supabase
 * imports on purpose, same as `orgs.ts` and `bookings.ts`, per the seam note
 * in booking-buddy/PROGRESS.md.
 *
 * Deliberately free of `geo-tz` too, even though `derive-time-zone.ts` (the
 * coordinate-derivation half of issue #20) needs `isKnownTimeZone` below:
 * `orgs.ts` and `bookings.ts` are imported directly by client components
 * (`orgs.tsx`, `bookings.tsx`) for their form-parsing constants, and `geo-tz`
 * reads its data file via `fs` — pulling it in here would drag `fs` into the
 * browser bundle and fail to resolve. `derive-time-zone.ts` is `server-only`
 * and is only ever imported from a Server Action.
 */

/**
 * Is this a zone anything can actually render?
 *
 * The trigger on `orgs` asks Postgres the same question and is the authority.
 * Asking here first is what turns a raw constraint violation into a sentence
 * about the form the User just filled in.
 */
export function isKnownTimeZone(zone: string): boolean {
  // `Intl` accepts bare offsets like `+05:30`, and `pg_timezone_names` does
  // not — so without this the trigger refuses a row this function just called
  // fine. An offset is not a zone in any case: it cannot say what happens when
  // the clocks change, which is the one thing storing the zone is for.
  if (!/^[A-Za-z]/.test(zone)) {
    return false;
  }

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}
