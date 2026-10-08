import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { after } from "next/server";

import { trackFirstSessionClosed } from "./analytics.ts";
import { assembleLoadedSession } from "./session/codec.ts";
import { projectSummary } from "./session/summary.ts";
import { isSessionStale } from "./session/stale.ts";
import type { SessionConfig } from "./session/types.ts";
import type { LoadedSession } from "./session/rotation-view.ts";
import { supabaseEventLog } from "./supabase/event-log.ts";

export type { LoadedSession } from "./session/rotation-view.ts";

type SessionRow = {
  id: string;
  club_id: string;
  venue_name: string;
  court_count: number;
  group_cap: number;
  floor_mode: SessionConfig["floorMode"];
  status: "open" | "closed";
  seed: string;
};

const SESSION_COLUMNS =
  "id, club_id, venue_name, court_count, group_cap, floor_mode, status, seed";

function toConfig(row: SessionRow): SessionConfig {
  return {
    sessionId: row.id,
    clubId: row.club_id,
    venueName: row.venue_name,
    courtCount: row.court_count,
    groupCap: row.group_cap,
    floorMode: row.floor_mode,
    seed: row.seed,
  };
}

/**
 * The Club's currently-open Session, or null. This is what the stable Club QR
 * path resolves against — readable as `anon` per the migration's policy, so no
 * auth session is needed.
 */
export async function getOpenSessionForClub(
  supabase: SupabaseClient,
  clubId: string,
): Promise<LoadedSession | null> {
  return (await loadOpenSessionWithLastRowAt(supabase, clubId))?.loaded ?? null;
}

/** The open Session as `getOpenSessionForClub` returns it, plus the
 * `lastRowAt` that `resolveOpenSessionForClub`'s auto-close check needs. */
async function loadOpenSessionWithLastRowAt(
  supabase: SupabaseClient,
  clubId: string,
): Promise<SessionWithLastRowAt | null> {
  const { data, error } = await supabase
    .from("on_deck_sessions")
    .select(SESSION_COLUMNS)
    .eq("club_id", clubId)
    .eq("status", "open")
    .maybeSingle();

  if (error) {
    throw new Error(`resolving the open Session failed: ${error.message}`);
  }
  if (!data) {
    return null;
  }

  return loadSession(supabase, data as SessionRow);
}

/**
 * The Club's open Session, auto-closing it first if its log has gone quiet
 * (issue #516) — an Organizer who forgot Last Call last week must never be
 * shown that night's stale board when they come back to start tonight's, and
 * starting tonight's must never be blocked by it either.
 *
 * Only ever able to succeed for the calling Organizer's own Club: the RPC
 * re-checks both ownership and staleness itself against the full event log in
 * plain SQL, so a failed attempt (not actually stale by the database's own
 * clock, a race with another close, not signed in as the owner) just falls
 * back to returning the Session as still open. This never surfaces an error to
 * a caller that only wanted to know "is one running", and it never
 * *incorrectly* closes one either: whatever this function's own idea of the
 * last event is, the database is the one that actually decides.
 *
 * That idea is the newest *row's* `at`, not the newest decoded event's: the
 * SQL takes `max(at)` over every row, a skipped one included, and the check
 * here has to agree with it.
 *
 * This does write during what is, for the home screen, a page render — fine
 * here specifically because that page is already dynamic (reads cookies for
 * auth) so nothing caches it, the RPC is idempotent, and every call site of
 * this function is the Organizer's own authenticated request for their own
 * Club, never a shared/public path.
 *
 * Callers that don't need this — the public Club QR page, which can't close
 * anything anyway since it has no Organizer session — use the plain
 * `getOpenSessionForClub` above instead.
 */
export async function resolveOpenSessionForClub(
  supabase: SupabaseClient,
  clubId: string,
): Promise<LoadedSession | null> {
  const open = await loadOpenSessionWithLastRowAt(supabase, clubId);
  if (!open) return null;
  const { loaded: openSession, lastRowAt } = open;

  if (lastRowAt === null || !isSessionStale(lastRowAt, Date.now())) {
    return openSession;
  }

  const summary = projectSummary(openSession.config, openSession.events);
  const { error } = await supabase.rpc("on_deck_auto_close_stale_session", {
    p_session_id: openSession.config.sessionId,
    p_summary: summary,
  });

  if (error) {
    // 55000 is the database's own, expected "not actually stale" refusal
    // (a clock-skew disagreement with the check above, or a race) — not worth
    // logging. Anything else is a real failure and worth knowing about, even
    // though the safe fallback here is the same either way: the Session
    // stays open rather than the page erroring over an auto-close attempt it
    // never asked for.
    if (error.code !== "55000") {
      console.error("on-deck: auto-close failed", error);
    }
    return openSession;
  }

  // The other half of `od_first_session_closed` (issue #524). A Session that
  // closed itself is still a night that ended, and it is the outcome most
  // worth seeing: an Organizer who walked away from their first night is the
  // clearest possible signal, and reading it as a deliberate close would hide
  // it. `after()` because this runs during the home screen's render as well as
  // inside Start, and neither should wait on analytics — and the caller's own
  // client, because Next refuses a fresh `cookies()` inside `after()` while
  // rendering and this one resolved them long before the callback existed.
  after(() => trackFirstSessionClosed(supabase, clubId, true));
  return null;
}

/**
 * One Session by id, folded with its event log. A `scheduled` Session
 * (issue #254) is pre-start and has no event log — it is edited through
 * `getScheduledSession`, never folded — so it is not returned here.
 */
export async function getSession(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<LoadedSession | null> {
  const { data, error } = await supabase
    .from("on_deck_sessions")
    .select(SESSION_COLUMNS)
    .eq("id", sessionId)
    .neq("status", "scheduled")
    .maybeSingle();

  if (error) {
    throw new Error(`loading the Session failed: ${error.message}`);
  }
  if (!data) {
    return null;
  }

  return (await loadSession(supabase, data as SessionRow)).loaded;
}

/**
 * A loaded Session's venue name, or null for one that couldn't be loaded —
 * a bad id, a bad Volunteer token, a Kiosk closed by Floor Mode, or a
 * database having a bad night. Shared by every room-facing page's
 * `generateMetadata` (the join screen, Display, Kiosk, the Volunteer Link)
 * so a lookup failure falls back to the same "On Deck" title everywhere
 * (issue #518, same null-safe shape as the Club QR resolver's `clubNameFor`
 * from issue #510).
 */
export function venueNameOf(loaded: LoadedSession | null): string | null {
  return loaded?.config.venueName ?? null;
}

/** A folded Session, plus its log's `lastRowAt` for the auto-close check. */
type SessionWithLastRowAt = { loaded: LoadedSession; lastRowAt: number | null };

/** Fold a Session row with its log, read through the Supabase event log. */
async function loadSession(
  supabase: SupabaseClient,
  row: SessionRow,
): Promise<SessionWithLastRowAt> {
  const log = await supabaseEventLog(supabase).load(row.id);
  return {
    loaded: assembleLoadedSession(toConfig(row), row.status, log),
    lastRowAt: log.lastRowAt,
  };
}

/**
 * A Session the Organizer set up ahead of time (issue #254) — sitting in the
 * `scheduled` state with its own date, venue, and court count, no event log
 * yet. Start promotes the due one into the open Session carrying these values.
 */
export type ScheduledSession = {
  id: string;
  clubId: string;
  /** ISO date (`YYYY-MM-DD`) the night is planned for. */
  scheduledFor: string;
  venueName: string;
  courtCount: number;
};

type ScheduledRow = {
  id: string;
  club_id: string;
  scheduled_for: string;
  venue_name: string;
  court_count: number;
};

const SCHEDULED_COLUMNS = "id, club_id, scheduled_for, venue_name, court_count";

function toScheduled(row: ScheduledRow): ScheduledSession {
  return {
    id: row.id,
    clubId: row.club_id,
    scheduledFor: row.scheduled_for,
    venueName: row.venue_name,
    courtCount: row.court_count,
  };
}

/**
 * Every not-yet-open Session for a Club, soonest first. RLS already scopes
 * `on_deck_sessions` to the owner for the non-open rows, so no `owner_id`
 * filter is needed here.
 */
export async function getScheduledSessionsForClub(
  supabase: SupabaseClient,
  clubId: string,
): Promise<ScheduledSession[]> {
  const { data, error } = await supabase
    .from("on_deck_sessions")
    .select(SCHEDULED_COLUMNS)
    .eq("club_id", clubId)
    .eq("status", "scheduled")
    .order("scheduled_for", { ascending: true });

  if (error) {
    throw new Error(`loading scheduled Sessions failed: ${error.message}`);
  }

  return (data as ScheduledRow[]).map(toScheduled);
}

/** One scheduled Session by id, or null if it is not scheduled (or not yours). */
export async function getScheduledSession(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<ScheduledSession | null> {
  const { data, error } = await supabase
    .from("on_deck_sessions")
    .select(SCHEDULED_COLUMNS)
    .eq("id", sessionId)
    .eq("status", "scheduled")
    .maybeSingle();

  if (error) {
    throw new Error(`loading the scheduled Session failed: ${error.message}`);
  }

  return data ? toScheduled(data as ScheduledRow) : null;
}
