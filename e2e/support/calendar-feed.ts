import type { APIRequestContext } from "@playwright/test";

import {
  LOCAL_SUPABASE_API_URL,
  LOCAL_SUPABASE_ANON_KEY,
  fixtureToken,
  fixtureUserId,
  type FixtureUser,
} from "./fixture-token.ts";

/**
 * Direct-Postgres seeding / teardown for `calendar-feed.spec.ts`, and a thin
 * client for the test-only `/api/e2e/calendar-feed` bridge route.
 *
 * The Calendar Feed backend (issue #294) ships without its UI, so the spec
 * seeds an Org straight through PostgREST (as the User — `orgs` is owner-only,
 * no `service_role` grant, same posture as `db-reset.ts`) and drives the real
 * server actions through the bridge route with the browser's own session.
 */

async function restAsUser<T>(
  user: FixtureUser,
  path: string,
  init: RequestInit & { returnRepresentation?: boolean } = {},
): Promise<T> {
  const token = await fixtureToken(user);
  const res = await fetch(`${LOCAL_SUPABASE_API_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: LOCAL_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.returnRepresentation ? { Prefer: "return=representation" } : {}),
      ...init.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`calendar-feed seed: ${init.method ?? "GET"} ${path} -> ${res.status} ${await res.text()}`);
  }
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

/** Creates a hand-named Facility and returns its id. */
export async function seedFacility(
  user: FixtureUser,
  name: string,
  timeZone = "America/Toronto",
): Promise<string> {
  const ownerId = await fixtureUserId(user);
  const rows = await restAsUser<{ id: string }[]>(user, "orgs", {
    method: "POST",
    returnRepresentation: true,
    body: JSON.stringify({ owner_id: ownerId, name, time_zone: timeZone, google_place_id: null }),
  });
  return rows[0].id;
}

/** Every Booking the caller holds for one Org, court label + start instant. */
export async function bookingsForOrg(
  user: FixtureUser,
  orgId: string,
): Promise<{ id: string; court_label: string | null; starts_at: string }[]> {
  return restAsUser(user, `bookings?org_id=eq.${orgId}&select=id,court_label,starts_at&order=starts_at`, {});
}

/** Every `org_feed_events` row for one Org. */
export async function feedEventsForOrg(
  user: FixtureUser,
  orgId: string,
): Promise<{ uid: string; status: string; booking_id: string | null; sequence: number }[]> {
  return restAsUser(
    user,
    `org_feed_events?org_id=eq.${orgId}&select=uid,status,booking_id,sequence&order=uid`,
    {},
  );
}

/** Sweeps every Facility the caller owns whose name starts with `prefix` (their feed events + bookings cascade). */
export async function deleteFacilities(user: FixtureUser, prefix: string): Promise<void> {
  await restAsUser(user, `orgs?name=like.${encodeURIComponent(`${prefix}%`)}`, { method: "DELETE" });
}

export type FeedActionResult = { ok?: true } | { error: string };
export type FeedReviewItem = {
  kind: "import";
  orgId: string;
  feedEventUid: string;
  sequence: number;
  facilityName: string;
  date: string;
  startTime: string;
  endTime: string;
  courtLabel: string | null;
  notes: string | null;
  format: string;
  name: string;
};
export type FacilityFeedResult =
  | { orgId: string; status: "ok"; items: FeedReviewItem[] }
  | { orgId: string; status: "error"; message: string };
export type SyncResult =
  | { status: "ok"; feeds: FacilityFeedResult[] }
  | { status: "error"; message: string };

/**
 * A client for the test-only bridge route. `request` is `page.request`, which
 * shares the browser context's session cookies, so the server actions run as
 * the signed-in User.
 */
export class FeedBridge {
  constructor(private readonly request: APIRequestContext) {}

  async #post<T>(body: unknown): Promise<T> {
    const res = await this.request.post("/api/e2e/calendar-feed", { data: body });
    if (!res.ok()) {
      throw new Error(`bridge ${JSON.stringify(body)} -> ${res.status()} ${await res.text()}`);
    }
    return (await res.json()) as T;
  }

  setFeedUrl(orgId: string, feedUrl: string): Promise<FeedActionResult> {
    return this.#post({ action: "setCalendarFeedUrl", fields: { org_id: orgId, feed_url: feedUrl } });
  }

  clearFeedUrl(orgId: string): Promise<FeedActionResult> {
    return this.#post({ action: "clearCalendarFeedUrl", fields: { org_id: orgId } });
  }

  syncAll(): Promise<SyncResult> {
    return this.#post({ action: "syncFacilityFeeds" });
  }

  syncOne(orgId: string): Promise<SyncResult> {
    return this.#post({ action: "syncFacilityFeed", orgId });
  }

  confirm(item: FeedReviewItem, feedStartsAt: string): Promise<FeedActionResult> {
    return this.#post({
      action: "confirmFeedCandidate",
      fields: {
        feed_event_uid: item.feedEventUid,
        org_id: item.orgId,
        sequence: String(item.sequence),
        starts_at: feedStartsAt,
        name: item.name,
        format: item.format,
        date: item.date,
        start_time: item.startTime,
        end_time: item.endTime,
        court_label: item.courtLabel ?? "",
        notes: item.notes ?? "",
        players: "",
      },
    });
  }

  dismiss(item: FeedReviewItem, feedStartsAt: string): Promise<FeedActionResult> {
    return this.#post({
      action: "dismissFeedCandidate",
      fields: {
        feed_event_uid: item.feedEventUid,
        org_id: item.orgId,
        sequence: String(item.sequence),
        starts_at: feedStartsAt,
      },
    });
  }

  confirmEmailCandidate(fields: Record<string, string>): Promise<FeedActionResult> {
    return this.#post({ action: "confirmImportCandidate", fields });
  }
}
