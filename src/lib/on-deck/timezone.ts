/**
 * Is this a zone anything can actually render?
 *
 * The `on_deck_clubs` trigger asks Postgres the same question against
 * `pg_timezone_names` and is the authority. Asking here first is what turns a
 * raw constraint violation into a sentence about the form the Organizer just
 * filled in.
 *
 * Its own copy rather than Booking Buddy's, for the reason `env.ts` opens
 * with: the two contexts share this Supabase project and nothing else
 * (CONTEXT-MAP.md), and ten lines of deliberate duplication is cheaper than a
 * dependency between them. Free of Next.js and Supabase imports so a client
 * component can call it.
 */
export function isKnownTimeZone(zone: string): boolean {
  // `Intl` accepts bare offsets like `+05:30`, and `pg_timezone_names` does
  // not — so without this the app would accept a zone the trigger then
  // refuses. An offset is not a zone in any case: it cannot say what happens
  // when the clocks change, which is the one thing storing a zone is for.
  if (!/^[A-Za-z]/.test(zone)) return false;

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Every zone this runtime knows, for the Settings picker. Rendered on the
 * server and handed to the client so both agree on the list —
 * `Intl.supportedValuesOf` is free to differ between Node's ICU build and the
 * browser's, and a hydration mismatch across a 600-option list is not worth
 * discovering in production.
 */
export function knownTimeZones(): string[] {
  const supported = (
    Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
  ).supportedValuesOf;

  // Older runtimes have no `supportedValuesOf`. A short honest list beats an
  // empty picker: the Organizer can still keep whatever zone is already set,
  // which the caller adds to this list.
  if (typeof supported !== "function") return ["UTC"];

  try {
    return supported("timeZone");
  } catch {
    return ["UTC"];
  }
}
