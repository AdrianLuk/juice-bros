/**
 * A Club-name-and-court-count draft, typed before an Organizer has signed in
 * (issue #520).
 *
 * `CreateClubForm` only ever renders after `verifyOrganizer` on
 * `/on-deck/home`, so a visitor who types their club's details on the sign-in
 * page first has nowhere to put them until then. Carried the way Booking
 * Buddy carries an invite token through sign-in (`INVITE_COOKIE`): a cookie
 * rather than `?next=`, because `safeRedirectTarget` strips any query string
 * off `next` and a magic-link or email-confirmation round trip can land in a
 * different request than the one that set it.
 *
 * Free of Next.js and browser imports so the client-side writer
 * (`OnDeckSignInForm`) and the server-side reader (`/on-deck/home`'s page)
 * share one definition of the cookie's name and shape without either pulling
 * in the other's runtime.
 */

export const CLUB_DRAFT_COOKIE = "od_club_draft";

/**
 * An hour — long enough to survive a magic-link email round trip, short
 * enough that a draft typed once and forgotten doesn't reappear on an
 * unrelated sign-in weeks later.
 */
export const CLUB_DRAFT_COOKIE_MAX_AGE_SECONDS = 60 * 60;

/** Shared with `validateClubName` (`actions/sessions.ts`) and every form that
 * takes a Club name — one number, so a name typed on the sign-in page is
 * never accepted (or truncated) to a different length than the same name
 * typed directly into `CreateClubForm` or Settings would be. */
export const CLUB_NAME_MAX = 120;

/** Shared with `validateCourtCount` for the same reason. */
export const COURT_COUNT_RANGE = { min: 1, max: 40 };

export type ClubDraft = { name: string; courtCount: string };

/** However many digits `COURT_COUNT_RANGE.max` takes — the real bound on how
 * long a court count typed by hand is ever worth keeping. Exported so a
 * typed field can cap what it shows to the same length this module caps a
 * cookie to, rather than letting the two silently disagree. */
export const COURT_COUNT_DIGITS = String(COURT_COUNT_RANGE.max).length;

/** Trimmed, with runs of space collapsed — the same normalisation the RPCs
 * apply. Shared with `validateClubName` (`actions/sessions.ts`) so a name
 * typed before sign-in and the same name typed directly into the create form
 * agree on what it collapses to, rather than the two silently disagreeing on
 * a name with doubled internal spaces. */
export function collapseSpaces(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/** Both fields cleaned before slicing (matching `parseClubDraft`), so
 * whitespace padding a name past the limit can't shave real characters off
 * the end that cleaning alone would have kept under it. */
function clampClubDraft(draft: ClubDraft): ClubDraft {
  return {
    name: collapseSpaces(draft.name).slice(0, CLUB_NAME_MAX),
    courtCount: draft.courtCount.trim().slice(0, COURT_COUNT_DIGITS),
  };
}

export function serializeClubDraft(draft: ClubDraft): string {
  return JSON.stringify(clampClubDraft(draft));
}

/**
 * A cookie's value is untrusted input — malformed JSON, or a shape from some
 * future version of this cookie, comes back as "no draft" rather than throws.
 * `null` when there is nothing worth seeding a form with.
 */
export function parseClubDraft(raw: string | null | undefined): ClubDraft | null {
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;
  const { name, courtCount } = parsed as Record<string, unknown>;
  const draft = clampClubDraft({
    name: typeof name === "string" ? name : "",
    courtCount: typeof courtCount === "string" ? courtCount : "",
  });

  return draft.name || draft.courtCount ? draft : null;
}

/** Shared by write and delete, so the attributes that have to match for a
 * delete to actually replace the cookie the browser already holds (`path`)
 * only ever live in one place. */
function setDraftCookie(value: string, maxAgeSeconds: number): void {
  if (typeof document === "undefined") return;
  const secure = location.protocol === "https:" ? "; Secure" : "";
  try {
    document.cookie = `${CLUB_DRAFT_COOKIE}=${value}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax${secure}`;
  } catch {
    // `encodeURIComponent` can throw on a lone surrogate a slice happened to
    // split a character on. Losing this one write costs the whole draft (both
    // fields are one JSON string), never a crash on the sign-in page.
  }
}

/**
 * Writes the draft cookie from the browser. Not `httpOnly`: there is no
 * secret in a club name and a court count, and the value has to be both
 * written and read from the client as the Organizer types, not just carried
 * through a server round trip.
 */
export function writeClubDraftCookie(draft: ClubDraft): void {
  setDraftCookie(
    encodeURIComponent(serializeClubDraft(draft)),
    CLUB_DRAFT_COOKIE_MAX_AGE_SECONDS,
  );
}

/**
 * Clears the draft cookie from the browser — used for an Organizer who
 * already has a Club and so never reaches `createClub`'s own cleanup. No
 * server round trip: the cookie is not `httpOnly`, so there is nothing a
 * client-side delete can't do that a Server Action would do better.
 */
export function clearClubDraftCookie(): void {
  setDraftCookie("", 0);
}
