import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { reduceSession } from "./session/reduce.ts";
import { isPauseReason, isSkillLevel } from "./session/types.ts";
import type {
  Operator,
  SessionConfig,
  SessionEvent,
  SessionState,
} from "./session/types.ts";
import type { LastEvent } from "./floor-ops.ts";

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
  seq: number;
  type: string;
  at: string;
  operator_kind: Operator["kind"];
  operator_user_id: string | null;
  payload: Record<string, unknown> | null;
};

const SESSION_COLUMNS =
  "id, club_id, venue_name, court_count, group_cap, floor_mode, status, seed";

const EVENT_COLUMNS = "seq, type, at, operator_kind, operator_user_id, payload";

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
  // Later tickets widen this map as they widen the fold. An unrecognised row,
  // or one whose payload doesn't carry what its type needs, is skipped rather
  // than mis-folded.
  const at = new Date(row.at).getTime();
  const operator = toOperator(row);

  switch (row.type) {
    case "SESSION_STARTED":
      return { type: "SESSION_STARTED", at, operator };

    case "PLAYER_JOINED": {
      const payload = row.payload ?? {};
      const token = payload.token;
      const firstName = payload.firstName;
      const lastInitial = payload.lastInitial;
      const skillLevel = payload.skillLevel;
      if (
        typeof token !== "string" ||
        typeof firstName !== "string" ||
        typeof lastInitial !== "string" ||
        !isSkillLevel(skillLevel)
      ) {
        return null;
      }
      return {
        type: "PLAYER_JOINED",
        at,
        operator,
        token,
        firstName,
        lastInitial,
        skillLevel,
        // Walk-up added by an Operator (issue #249) — straight into the Queue.
        queueOnJoin: payload.queueOnJoin === true,
      };
    }

    case "PLAYER_SKILL_SET": {
      const payload = row.payload ?? {};
      const token = payload.token;
      const skillLevel = payload.skillLevel;
      if (typeof token !== "string" || !isSkillLevel(skillLevel)) {
        return null;
      }
      return { type: "PLAYER_SKILL_SET", at, operator, token, skillLevel };
    }

    case "PLAYER_QUEUED": {
      const token = (row.payload ?? {}).token;
      if (typeof token !== "string") {
        return null;
      }
      return { type: "PLAYER_QUEUED", at, operator, token };
    }

    case "COURT_FINISHED": {
      const court = (row.payload ?? {}).court;
      if (typeof court !== "number" || !Number.isInteger(court)) {
        return null;
      }
      return { type: "COURT_FINISHED", at, operator, court };
    }

    case "PLAYER_PAUSED": {
      const payload = row.payload ?? {};
      const token = payload.token;
      const reason = payload.reason;
      if (typeof token !== "string" || !isPauseReason(reason)) {
        return null;
      }
      return { type: "PLAYER_PAUSED", at, operator, token, reason };
    }

    case "PLAYER_REQUEUED": {
      const token = (row.payload ?? {}).token;
      if (typeof token !== "string") {
        return null;
      }
      return { type: "PLAYER_REQUEUED", at, operator, token };
    }

    case "FOURSOME_MEMBER_SWAPPED": {
      const payload = row.payload ?? {};
      const court = payload.court;
      const out = payload.out;
      const inbound = payload.in;
      if (
        typeof court !== "number" ||
        !Number.isInteger(court) ||
        typeof out !== "string" ||
        typeof inbound !== "string"
      ) {
        return null;
      }
      return {
        type: "FOURSOME_MEMBER_SWAPPED",
        at,
        operator,
        court,
        out,
        in: inbound,
      };
    }

    case "GROUP_FORMED": {
      const payload = row.payload ?? {};
      const groupId = payload.groupId;
      const memberTokens = payload.memberTokens;
      if (
        typeof groupId !== "string" ||
        !Array.isArray(memberTokens) ||
        !memberTokens.every((t): t is string => typeof t === "string")
      ) {
        return null;
      }
      return { type: "GROUP_FORMED", at, operator, groupId, memberTokens };
    }

    case "GROUP_CAP_CHANGED": {
      const cap = (row.payload ?? {}).cap;
      if (typeof cap !== "number" || !Number.isInteger(cap)) {
        return null;
      }
      return { type: "GROUP_CAP_CHANGED", at, operator, cap };
    }

    default:
      return null;
  }
}

export type LoadedSession = {
  config: SessionConfig;
  status: "open" | "closed";
  state: SessionState;
  /**
   * The raw most recent event row, or null for an eventless Session. What
   * operator Undo (#247) needs that the fold discards: the seq to target, and
   * enough to decide whether it is an Operator's to undo and whose tap it was.
   */
  lastEvent: LastEvent | null;
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
    .select(EVENT_COLUMNS)
    .eq("session_id", row.id)
    .order("seq", { ascending: true });

  if (error) {
    throw new Error(`loading the Session's events failed: ${error.message}`);
  }

  const config = toConfig(row);
  const rows = data as EventRow[];
  const events = rows
    .map(toEvent)
    .filter((event): event is SessionEvent => event !== null);

  const lastRow = rows[rows.length - 1];
  const lastEvent: LastEvent | null = lastRow
    ? {
        seq: lastRow.seq,
        type: lastRow.type,
        at: new Date(lastRow.at).getTime(),
        operator: toOperator(lastRow),
      }
    : null;

  return {
    config,
    status: row.status,
    state: reduceSession(config, events),
    lastEvent,
  };
}
