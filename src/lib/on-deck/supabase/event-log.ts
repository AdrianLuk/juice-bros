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
 * `SessionEventLog` over a Supabase client: what the live loader
 * (`../sessions.ts`) reads through and the Organizer's floor actions
 * (`../actions/floor.ts`) write through.
 *
 * `append` is the Organizer's plain INSERT under the foundation's "an
 * Organizer appends events to their own open Session" policy, so it takes only
 * an organizer from that Organizer's own client; a Volunteer, Kiosk or Player
 * appends through its RPC. It never sends `at`: the column's `default now()`
 * stamps the row, on the database's clock, which auto-close's `max(at)` is
 * measured against.
 *
 * `load` adds `lastRowAt`: the latest `at` over every row, decoded or not,
 * which is exactly auto-close's SQL `max(at)`.
 */
export function supabaseEventLog(supabase: SupabaseClient): SessionEventLog {
  return {
    async append(sessionId, body, operator) {
      const { error } = await supabase.from("on_deck_session_events").insert({
        session_id: sessionId,
        ...encode(body),
        operator_kind: operator.kind,
        operator_user_id: operator.kind === "organizer" ? operator.userId : null,
      });
      if (error) {
        throw new Error(`appending ${body.type} failed: ${error.message}`);
      }
    },
    async load(sessionId) {
      const rows = await loadRows(supabase, sessionId);
      let lastRowAt: number | null = null;
      for (const row of rows) {
        const at = new Date(row.at).getTime();
        if (lastRowAt === null || at > lastRowAt) lastRowAt = at;
      }
      return { ...decodeLog(rows), lastRowAt };
    },
  };
}
