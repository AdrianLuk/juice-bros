import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { reduceSession } from "./session/reduce.ts";
import type {
  Operator,
  SessionConfig,
  SessionEvent,
  SessionState,
} from "./session/types.ts";

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

type EventRow = {
  type: string;
  at: string;
  operator_kind: Operator["kind"];
  operator_user_id: string | null;
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

function toOperator(row: EventRow): Operator {
  if (row.operator_kind === "organizer") {
    return { kind: "organizer", userId: row.operator_user_id ?? "" };
  }
  return { kind: row.operator_kind };
}

function toEvent(row: EventRow): SessionEvent | null {
  // Only SESSION_STARTED is modelled so far; later tickets widen this map as
  // they widen the fold. An unrecognised row is skipped rather than
  // mis-folded.
  if (row.type !== "SESSION_STARTED") {
    return null;
  }
  return {
    type: "SESSION_STARTED",
    at: new Date(row.at).getTime(),
    operator: toOperator(row),
  };
}

export type LoadedSession = {
  config: SessionConfig;
  status: "open" | "closed";
  state: SessionState;
};

/**
 * The Club's currently-open Session, or null. This is what the stable Club QR
 * path resolves against — readable as `anon` per the migration's policy, so no
 * auth session is needed.
 */
export async function getOpenSessionForClub(
  supabase: SupabaseClient,
  clubId: string,
): Promise<LoadedSession | null> {
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

/** One Session by id, folded with its event log. */
export async function getSession(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<LoadedSession | null> {
  const { data, error } = await supabase
    .from("on_deck_sessions")
    .select(SESSION_COLUMNS)
    .eq("id", sessionId)
    .maybeSingle();

  if (error) {
    throw new Error(`loading the Session failed: ${error.message}`);
  }
  if (!data) {
    return null;
  }

  return loadSession(supabase, data as SessionRow);
}

async function loadSession(
  supabase: SupabaseClient,
  row: SessionRow,
): Promise<LoadedSession> {
  const { data, error } = await supabase
    .from("on_deck_session_events")
    .select("type, at, operator_kind, operator_user_id")
    .eq("session_id", row.id)
    .order("seq", { ascending: true });

  if (error) {
    throw new Error(`loading the Session's events failed: ${error.message}`);
  }

  const config = toConfig(row);
  const events = (data as EventRow[])
    .map(toEvent)
    .filter((event): event is SessionEvent => event !== null);

  return {
    config,
    status: row.status,
    state: reduceSession(config, events),
  };
}
