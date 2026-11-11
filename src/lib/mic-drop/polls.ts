/**
 * Mic Drop's store (spec #666): everything the Host and Guest screens ask of
 * the database. Each function takes the caller's `SupabaseClient`, so a Host's
 * calls run as the signed-in Host and a Guest's as `anon`; the database does
 * the checking (the allowlist, ownership, the Guest Link token).
 *
 * Relative imports only, so `npm run test:db` loads it directly.
 */

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

/** A write's outcome: done, or refused with a reason the Host or Guest can read. */
export type Outcome<T = undefined> =
  | (T extends undefined ? { ok: true } : { ok: true; value: T })
  | { ok: false; problem: string };

export type LeaderboardEntry = {
  id: string;
  name: string;
  votes: number;
};

/** One Poll as anyone holding its Guest Link sees it. */
export type GuestPoll = {
  id: string;
  name: string;
  open: boolean;
  /** How many phones currently have a Vote. */
  phonesIn: number;
  /** Most Votes first; entry order breaks ties. */
  contestants: LeaderboardEntry[];
  /** The asking phone's Contestant, or null when it has no Vote. */
  myVote: string | null;
  /** Once closed, every Contestant tied on the top count, in entry order. Empty while open or with no Votes. */
  winnerIds: string[];
};

export type PollSummary = {
  id: string;
  name: string;
  open: boolean;
  /** The token behind the Guest Link. */
  guestToken: string;
  contestantCount: number;
  createdAt: string;
};

/** Codes the Mic Drop functions raise with a reason meant for people. */
const TOLD_CODES = new Set(["22023", "42501", "P0002"]);

/**
 * A write's error as an `Outcome`: a refusal the database worded for people
 * comes back as `problem`; a malformed id from the page reads as `notFound`;
 * anything else is a real failure and throws.
 */
function settle(error: PostgrestError, what: string, notFound?: string): { ok: false; problem: string } {
  if (TOLD_CODES.has(error.code)) return { ok: false, problem: error.message };
  if (notFound && error.code === "22P02") return { ok: false, problem: notFound };
  throw new Error(`${what} failed: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Guests
// ---------------------------------------------------------------------------

/** The Poll behind a Guest Link token, or null when there's no such Poll. */
export async function readGuestPoll(
  supabase: SupabaseClient,
  token: string,
  guestId?: string,
): Promise<GuestPoll | null> {
  const { data, error } = await supabase.rpc("mic_drop_guest_poll", {
    p_token: token,
    p_guest_id: guestId ?? null,
  });
  if (error) throw new Error(`Reading the Poll failed: ${error.message}`);
  return (data as GuestPoll | null) ?? null;
}

/** Makes `contestantId` this phone's Vote, replacing any earlier one. */
export async function castVote(
  supabase: SupabaseClient,
  token: string,
  guestId: string,
  contestantId: string,
): Promise<Outcome> {
  const { error } = await supabase.rpc("mic_drop_cast_vote", {
    p_token: token,
    p_guest_id: guestId,
    p_contestant_id: contestantId,
  });
  return error ? settle(error, "Voting", "That Contestant isn't in this Poll.") : { ok: true };
}

// ---------------------------------------------------------------------------
// Hosts
// ---------------------------------------------------------------------------

/** True when the signed-in account is on the Host allowlist. */
export async function isHost(supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await supabase.rpc("mic_drop_is_host");
  if (error) throw new Error(`Checking the Host allowlist failed: ${error.message}`);
  return data === true;
}

/** Creates an open Poll. */
export async function createPoll(
  supabase: SupabaseClient,
  name: string,
): Promise<Outcome<{ id: string; guestToken: string }>> {
  const { data, error } = await supabase.rpc("mic_drop_create_poll", { p_name: name });
  return error
    ? settle(error, "Creating the Poll")
    : { ok: true, value: data as { id: string; guestToken: string } };
}

const SUMMARY_COLUMNS = "id, name, closed_at, guest_token, created_at, mic_drop_contestants(count)";

type SummaryRow = {
  id: string;
  name: string;
  closed_at: string | null;
  guest_token: string;
  created_at: string;
  mic_drop_contestants: { count: number }[];
};

function toSummary(row: SummaryRow): PollSummary {
  return {
    id: row.id,
    name: row.name,
    open: row.closed_at === null,
    guestToken: row.guest_token,
    contestantCount: row.mic_drop_contestants[0]?.count ?? 0,
    createdAt: row.created_at,
  };
}

/** The Host's own Polls, newest first. Empty for an account that isn't a Host. */
export async function listPolls(supabase: SupabaseClient): Promise<PollSummary[]> {
  const { data, error } = await supabase
    .from("mic_drop_polls")
    .select(SUMMARY_COLUMNS)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Listing Polls failed: ${error.message}`);
  return ((data ?? []) as unknown as SummaryRow[]).map(toSummary);
}

/** One of the Host's own Polls, or null when it isn't theirs or doesn't exist. */
export async function loadPoll(supabase: SupabaseClient, pollId: string): Promise<PollSummary | null> {
  const { data, error } = await supabase
    .from("mic_drop_polls")
    .select(SUMMARY_COLUMNS)
    .eq("id", pollId)
    .maybeSingle();
  if (error) {
    if (error.code === "22P02") return null;
    throw new Error(`Loading the Poll failed: ${error.message}`);
  }
  return data ? toSummary(data as unknown as SummaryRow) : null;
}

/** Adds a Contestant to the end of an open Poll's line-up. */
export async function addContestant(
  supabase: SupabaseClient,
  pollId: string,
  name: string,
): Promise<Outcome<string>> {
  const { data, error } = await supabase.rpc("mic_drop_add_contestant", {
    p_poll_id: pollId,
    p_name: name,
  });
  return error
    ? settle(error, "Adding the Contestant", "That Poll doesn't exist.")
    : { ok: true, value: data as string };
}

/** Removes a Contestant from an open Poll, and the Votes cast for them. */
export async function removeContestant(
  supabase: SupabaseClient,
  contestantId: string,
): Promise<Outcome> {
  const { error } = await supabase.rpc("mic_drop_remove_contestant", {
    p_contestant_id: contestantId,
  });
  return error ? settle(error, "Removing the Contestant", "That Contestant doesn't exist.") : { ok: true };
}

/** Closes the Poll: the Leaderboard freezes and Votes are refused. */
export function closePoll(supabase: SupabaseClient, pollId: string): Promise<Outcome> {
  return setOpen(supabase, pollId, false);
}

/** Reopens a closed Poll so it takes Votes again. */
export function reopenPoll(supabase: SupabaseClient, pollId: string): Promise<Outcome> {
  return setOpen(supabase, pollId, true);
}

async function setOpen(supabase: SupabaseClient, pollId: string, open: boolean): Promise<Outcome> {
  const { error } = await supabase.rpc("mic_drop_set_open", { p_poll_id: pollId, p_open: open });
  return error
    ? settle(error, open ? "Reopening the Poll" : "Closing the Poll", "That Poll doesn't exist.")
    : { ok: true };
}
