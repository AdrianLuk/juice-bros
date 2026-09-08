import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { SessionSummary } from "./session/summary.ts";

/**
 * Reading the Session Summary (issue #469).
 *
 * The write side has existed since #255: `on_deck_close_session` stores the
 * projection the moment a Session closes, and purges the roster and the event
 * log in the same transaction (ADR 0001). This is the other half — the read.
 *
 * RLS already scopes `on_deck_session_summaries` to the owning Organizer, so
 * nothing here filters on `owner_id`; a Summary belonging to another Club
 * simply is not there. `getSessionSummary` still returns null rather than
 * throwing for a missing row, so the page can 404 rather than 500 for the
 * same reason a mistyped id should.
 */

/** One closed night, as the list needs it — no JSONB unpacked. */
export type SummaryListing = {
  sessionId: string;
  venueName: string;
  attendance: number;
  gamesPlayed: number;
  /** ISO timestamp play began. What names the night — see `night-label.ts`. */
  startedAt: string;
  /** ISO timestamp the Session was closed. What orders the list. */
  closedAt: string;
};

/** One closed night in full, with the projection parsed. */
export type SummaryDetail = SummaryListing & {
  courtCount: number;
  summary: SessionSummary;
};

type SessionEmbed = { venue_name: string; court_count: number } | null;

type ListingRow = {
  session_id: string;
  attendance: number;
  games_played: number;
  session_started_at: string;
  session_closed_at: string;
  on_deck_sessions: SessionEmbed;
};

type DetailRow = ListingRow & {
  summary: unknown;
};

// The venue and court count live on the Session row, which is deliberately
// kept when a Session closes — it is already numbers, not people. Embedding is
// cheaper than a second round trip and the foreign key makes it one query.
const LISTING_COLUMNS =
  "session_id, attendance, games_played, session_started_at, session_closed_at, on_deck_sessions(venue_name, court_count)";
const DETAIL_COLUMNS = `${LISTING_COLUMNS}, summary`;

function toListing(row: ListingRow): SummaryListing {
  return {
    sessionId: row.session_id,
    venueName: row.on_deck_sessions?.venue_name ?? "",
    attendance: row.attendance,
    gamesPlayed: row.games_played,
    startedAt: row.session_started_at,
    closedAt: row.session_closed_at,
  };
}

/**
 * Every closed Session for a Club, most recent first — the order the index on
 * `(club_id, session_closed_at desc)` was built for.
 *
 * `limit` is for the handful shown on the Organizer's home screen; the full
 * list passes none.
 */
export async function getSummariesForClub(
  supabase: SupabaseClient,
  clubId: string,
  limit?: number,
): Promise<SummaryListing[]> {
  let query = supabase
    .from("on_deck_session_summaries")
    .select(LISTING_COLUMNS)
    .eq("club_id", clubId)
    .order("session_closed_at", { ascending: false });

  if (limit !== undefined) query = query.limit(limit);

  const { data, error } = await query;

  if (error) {
    throw new Error(`loading Session summaries failed: ${error.message}`);
  }

  return (data as unknown as ListingRow[]).map(toListing);
}

/**
 * One Session's Summary, or null when there is none the caller may read —
 * never closed, never existed, or another Club's.
 *
 * The stored `summary` is JSONB written from `SessionSummary` by the same
 * codebase, but it is still data crossing a boundary, and the column is
 * deliberately schemaless so the projection can grow without a migration. So
 * the shape is checked rather than asserted: an older row missing a field a
 * newer page reads would otherwise crash the page rather than skip a section.
 */
export async function getSessionSummary(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<SummaryDetail | null> {
  const { data, error } = await supabase
    .from("on_deck_session_summaries")
    .select(DETAIL_COLUMNS)
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error) {
    throw new Error(`loading the Session Summary failed: ${error.message}`);
  }
  if (!data) return null;

  const row = data as unknown as DetailRow;
  const summary = asSessionSummary(row.summary);
  if (!summary) return null;

  return {
    ...toListing(row),
    courtCount: row.on_deck_sessions?.court_count ?? 0,
    summary,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * The stored JSONB, if it carries the pieces every section of the reader
 * needs. Anything short of that is treated as unreadable rather than
 * half-rendered — a Summary showing three of its five numbers with no
 * explanation is worse than one that says it cannot be read.
 */
function asSessionSummary(value: unknown): SessionSummary | null {
  if (!isRecord(value)) return null;

  const { courtUtilization, waitTime, skillMix } = value;
  if (!isRecord(courtUtilization) || !isRecord(waitTime) || !isRecord(skillMix)) {
    return null;
  }
  if (typeof value.attendance !== "number" || typeof value.gamesPlayed !== "number") {
    return null;
  }
  if (!Array.isArray(courtUtilization.perCourt)) return null;
  if (!Array.isArray(waitTime.distribution)) return null;

  return value as unknown as SessionSummary;
}
