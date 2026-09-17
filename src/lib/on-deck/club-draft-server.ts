import "server-only";
import { cookies } from "next/headers";

import { CLUB_DRAFT_COOKIE, parseClubDraft, type ClubDraft } from "./club-draft.ts";

/**
 * The server-side half of the Club-draft cookie (issue #520) — split from
 * `club-draft.ts` so that module can stay free of `next/headers` and be safe
 * to import from a client component (`ClubDraftTeaser` writes the cookie
 * directly from the browser).
 */

/** Whatever is sitting in the draft cookie for this request, or `null`. */
export async function readClubDraft(): Promise<ClubDraft | null> {
  return parseClubDraft((await cookies()).get(CLUB_DRAFT_COOKIE)?.value);
}

/**
 * Deletes the draft cookie from a Server Action — called once the draft has
 * done its job: `createClub` on success (both the ordinary one and the
 * `ClubAlreadyExistsError` race), and `signOut`, so a shared device's next
 * sign-in doesn't inherit whatever the last account typed. Deleting twice is
 * harmless, so this deliberately overlaps with `ClearStrayClubDraft`'s own
 * delete rather than depending on it — that component exists for the
 * Organizer who never calls `createClub` at all (a draft typed on the way
 * back into an account that already has a Club), not as this action's own
 * cleanup mechanism.
 */
export async function deleteClubDraftCookie(): Promise<void> {
  (await cookies()).delete(CLUB_DRAFT_COOKIE);
}
