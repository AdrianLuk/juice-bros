"use server";

import { castVote, readGuestPoll, withdrawVote, type GuestPoll, type Outcome } from "../polls.ts";
import { createClient } from "../supabase/server.ts";

/**
 * A Guest's two calls, as Server Actions: the Guest Link token stays in the
 * page's URL and these requests, never in a browser-side database query (the
 * same posture as Team Tally's Score Link). The database checks the token,
 * the Guest id's format and whether the Poll is open.
 */

/** The Poll as this phone sees it, or null when the Guest Link is wrong. */
export async function readPoll(token: string, guestId: string | null): Promise<GuestPoll | null> {
  return readGuestPoll(await createClient(), token, guestId ?? undefined);
}

/** Makes `contestantId` this phone's Vote. A refusal says why, in words a Guest can read. */
export async function vote(token: string, guestId: string, contestantId: string): Promise<Outcome> {
  return castVote(await createClient(), token, guestId, contestantId);
}

/** Takes back this phone's Vote. */
export async function unvote(token: string, guestId: string): Promise<Outcome> {
  return withdrawVote(await createClient(), token, guestId);
}
