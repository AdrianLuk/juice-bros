/**
 * The write side of the Session event codec: an `EventBody` (a `SessionEvent`
 * without `at` and `operator`) to the `{ type, payload }` a row carries.
 *
 * It writes the payload keys SQL already reads by name — the unique indexes on
 * `payload->>'token'`, `on_deck_is_paused` reading `token` / `out`, the queue
 * and form-group pre-checks, the Volunteer and Kiosk append whitelists — so
 * changing a key here is a migration, not a refactor. `codec.test.ts` pins
 * every shape.
 *
 * Relative imports only and no `@supabase/*`, even as a type: the Demo night
 * imports this, and `demo/import-graph.test.ts` keeps its graph clear of a
 * Supabase client.
 */

import type { EventBody } from "./types.ts";

/** A payload value as Postgres `jsonb` holds it. */
export type PayloadValue = string | number | boolean | null | string[];

/** The `payload` column: a flat object of `PayloadValue`s. */
export type EventPayload = Record<string, PayloadValue>;

/** A row's `type` and `payload` columns. */
export type EncodedEvent = {
  type: EventBody["type"];
  payload: EventPayload;
};

export function encode(body: EventBody): EncodedEvent {
  switch (body.type) {
    case "PLAYER_JOINED":
      return {
        type: body.type,
        payload: {
          token: body.token,
          firstName: body.firstName,
          lastInitial: body.lastInitial,
          skillLevel: body.skillLevel,
          // Only an Operator's walk-up carries it; a self-registered Player's
          // row (written by `on_deck_player_join`) has no such key.
          ...(body.queueOnJoin === undefined
            ? {}
            : { queueOnJoin: body.queueOnJoin }),
        },
      };
    case "PLAYER_SKILL_SET":
      return {
        type: body.type,
        payload: { token: body.token, skillLevel: body.skillLevel },
      };
    case "PLAYER_QUEUED":
    case "PLAYER_REQUEUED":
      return { type: body.type, payload: { token: body.token } };
    case "COURT_FINISHED":
      return { type: body.type, payload: { court: body.court } };
    case "COURT_CONFIRMED":
      return {
        type: body.type,
        payload: { court: body.court, since: body.since },
      };
    case "PLAYER_PAUSED":
      return {
        type: body.type,
        payload: { token: body.token, reason: body.reason },
      };
    case "FOURSOME_MEMBER_SWAPPED":
      return {
        type: body.type,
        payload: { court: body.court, out: body.out, in: body.in },
      };
    case "GROUP_FORMED":
      return {
        type: body.type,
        payload: {
          groupId: body.groupId,
          memberTokens: [...body.memberTokens],
        },
      };
    case "GROUP_MEMBER_REMOVED":
      return {
        type: body.type,
        payload: { groupId: body.groupId, token: body.token },
      };
    case "GROUP_DISSOLVED":
      return { type: body.type, payload: { groupId: body.groupId } };
    case "GROUP_CAP_CHANGED":
      return { type: body.type, payload: { cap: body.cap } };
    // Structural events: SQL stamps SESSION_STARTED's config keys itself and
    // nothing decodes them; LAST_CALL and SESSION_CLOSED carry nothing.
    case "SESSION_STARTED":
    case "LAST_CALL":
    case "SESSION_CLOSED":
      return { type: body.type, payload: {} };
  }
}
