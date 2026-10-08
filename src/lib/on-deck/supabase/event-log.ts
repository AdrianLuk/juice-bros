/**
 * The Supabase adapter for a Session's event log (issue #618): rows in
 * `on_deck_session_events`, decoded by the codec (`../session/codec.ts`) and
 * nowhere else.
 *
 * Relative imports only and no `server-only`, so `npm run test:db` can run the
 * `SessionEventLog` contract against it. It lives under `lib/on-deck/supabase`,
 * which `demo/import-graph.test.ts` keeps out of the Demo night's graph.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  decodeLog,
  encode,
  type EventRow,
  type LoggedEvents,
  type SessionEventLog,
} from "../session/codec.ts";

const EVENT_COLUMNS = "seq, type, at, operator_kind, operator_user_id, payload";

/**
 * PostgREST's `max_rows` (`supabase/config.toml`): the most one request
 * returns, however many rows match. A page shorter than this is the last one.
 */
const PAGE_SIZE = 1000;

/**
 * Every row of one Session's log, in `seq` order, a page at a time — a
 * single select would stop silently at `max_rows` and fold a truncated night.
 * Offset paging is safe here: the log only grows at its end, and the one
 * delete (Undo) only ever takes the newest row, so no earlier row's offset
 * moves between pages.
 */
async function loadRows(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<EventRow[]> {
  const rows: EventRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("on_deck_session_events")
      .select(EVENT_COLUMNS)
      .eq("session_id", sessionId)
      .order("seq", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`loading the Session's events failed: ${error.message}`);
    }
    const page = data as EventRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

/**
 * The decoded log, plus `lastRowAt`: the newest row's `at` whether or not it
 * decoded. That is what auto-close's SQL compares (`max(at)` over every row),
 * so the staleness pre-check reads it rather than the last *decoded* event.
 */
export async function loadEventLog(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<LoggedEvents & { lastRowAt: number | null }> {
  const rows = await loadRows(supabase, sessionId);
  const lastRow = rows[rows.length - 1];
  return {
    ...decodeLog(rows),
    lastRowAt: lastRow ? new Date(lastRow.at).getTime() : null,
  };
}

/**
 * `SessionEventLog` over a Supabase client. `append` is the Organizer's plain
 * INSERT under the foundation's "an Organizer appends events to their own
 * open Session" policy, so it takes only an organizer event from that
 * Organizer's own client; a Volunteer or Kiosk appends through its RPC
 * (`commitFloorOutcome`).
 */
export function supabaseEventLog(supabase: SupabaseClient): SessionEventLog {
  return {
    async append(sessionId, event) {
      const { at, operator, ...body } = event;
      const { error } = await supabase.from("on_deck_session_events").insert({
        session_id: sessionId,
        ...encode(body),
        operator_kind: operator.kind,
        operator_user_id: operator.kind === "organizer" ? operator.userId : null,
        at: new Date(at).toISOString(),
      });
      if (error) {
        throw new Error(`appending ${event.type} failed: ${error.message}`);
      }
    },
    async load(sessionId) {
      const { events, lastEvent } = await loadEventLog(supabase, sessionId);
      return { events, lastEvent };
    },
  };
}
