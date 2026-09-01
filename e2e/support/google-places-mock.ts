import http from "node:http";

import { listenOnFixedPort } from "./mock-server.ts";

/**
 * Fixed rather than OS-assigned: `playwright.config.ts` has to bake this URL
 * into `webServer.env` before the dev server (which Playwright only starts
 * itself in CI — see `booking-buddy/docs/testing.md`) boots, so the port has
 * to be known ahead of time rather than discovered after listening.
 */
export const GOOGLE_PLACES_MOCK_PORT = 5602;
export const GOOGLE_PLACES_MOCK_URL = `http://127.0.0.1:${GOOGLE_PLACES_MOCK_PORT}`;

export type MockPlace = {
  placeId: string;
  name: string;
  formattedAddress: string;
  latitude?: number;
  longitude?: number;
};

type SearchOutcome = MockPlace[] | "unavailable";
type DetailsOutcome = MockPlace | "not_found" | "unavailable";

function toRawPlace(place: MockPlace) {
  return {
    id: place.placeId,
    displayName: { text: place.name, languageCode: "en" },
    formattedAddress: place.formattedAddress,
    ...(place.latitude !== undefined && place.longitude !== undefined
      ? { location: { latitude: place.latitude, longitude: place.longitude } }
      : {}),
  };
}

/** Local Docker stack only — Supabase's published demo keys, same as scripts/seed-booking-buddy-users.mts. */
const LOCAL_SUPABASE_API_URL = "http://127.0.0.1:54321";
const LOCAL_SUPABASE_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

/**
 * Deletes exactly the `place_cache` rows this test file's mocked picks wrote,
 * direct against PostgREST with the service-role key — the app itself has no
 * such action (ADR 0005: nothing evicts a cached Place), so cleanup can't go
 * through the UI the way removing an Org does. Without this, `place_cache`
 * keeps growing across local runs and the pgTAP suite's "starts from what
 * this transaction seeded" assertions on that table stop holding.
 */
export async function deleteCachedPlaces(placeIds: string[]): Promise<void> {
  await Promise.all(
    placeIds.map((placeId) => {
      const url = new URL(`${LOCAL_SUPABASE_API_URL}/rest/v1/place_cache`);
      url.searchParams.set("place_id", `eq.${placeId}`);
      return fetch(url, {
        method: "DELETE",
        headers: {
          apikey: LOCAL_SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${LOCAL_SUPABASE_SERVICE_ROLE_KEY}`,
        },
      });
    }),
  );
}

async function readJsonBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req as AsyncIterable<Buffer>) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
}

/**
 * A fixture stand-in for the Places API (New) — `google-places-client.ts`'s
 * two endpoints only. Real request/response shapes (field names, the 404 for
 * a dead `place_id`), so a shape mismatch against the real API would show up
 * as a parse failure here too rather than being masked by a looser mock.
 */
export class GooglePlacesMock {
  #server: http.Server;
  #searchByQuery = new Map<string, SearchOutcome>();
  #detailsByPlaceId = new Map<string, DetailsOutcome>();
  #detailsRequestCounts = new Map<string, number>();

  constructor() {
    this.#server = http.createServer((req, res) => {
      this.#handle(req, res).catch((error: unknown) => {
        console.error("google-places-mock: request handling failed", error);
        res.writeHead(500).end();
      });
    });
  }

  async start(): Promise<void> {
    await listenOnFixedPort(
      this.#server,
      GOOGLE_PLACES_MOCK_PORT,
      "google-places-mock",
    );
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.#server.close((error) => (error ? reject(error) : resolve()));
    });
  }

  registerSearch(query: string, outcome: SearchOutcome): void {
    this.#searchByQuery.set(query, outcome);
  }

  registerDetails(placeId: string, outcome: DetailsOutcome): void {
    this.#detailsByPlaceId.set(placeId, outcome);
  }

  /** How many times Details has been asked for this `place_id` so far. */
  detailsRequestCount(placeId: string): number {
    return this.#detailsRequestCounts.get(placeId) ?? 0;
  }

  /**
   * Every `place_id` registered with a real (non-`"not_found"`,
   * non-`"unavailable"`) Details outcome — i.e. everything a test run of this
   * file could actually have written into the real local `place_cache` table.
   * `place_cache` rows aren't scoped to a test run the way Orgs are (ADR
   * 0005: removing an Org must not evict the Place it pointed at), so nothing
   * in the app itself cleans these up — `places.spec.ts` sweeps them by id
   * directly against Postgres once the whole file is done, so the pgTAP
   * suite still sees a table it seeded from scratch.
   */
  cacheablePlaceIds(): string[] {
    return [...this.#detailsByPlaceId.entries()]
      .filter(([, outcome]) => outcome !== "not_found" && outcome !== "unavailable")
      .map(([placeId]) => placeId);
  }

  async #handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = new URL(req.url ?? "/", GOOGLE_PLACES_MOCK_URL);

    if (req.method === "POST" && url.pathname === "/v1/places:searchText") {
      const body = await readJsonBody(req);
      const query = typeof body.textQuery === "string" ? body.textQuery : "";
      const outcome = this.#searchByQuery.get(query) ?? [];

      if (outcome === "unavailable") {
        res
          .writeHead(500, { "Content-Type": "application/json" })
          .end(JSON.stringify({ error: { message: "mock unavailable" } }));
        return;
      }

      res
        .writeHead(200, { "Content-Type": "application/json" })
        .end(JSON.stringify({ places: outcome.map(toRawPlace) }));
      return;
    }

    if (req.method === "GET" && url.pathname.startsWith("/v1/places/")) {
      const placeId = decodeURIComponent(url.pathname.slice("/v1/places/".length));
      this.#detailsRequestCounts.set(placeId, this.detailsRequestCount(placeId) + 1);

      const outcome = this.#detailsByPlaceId.get(placeId);

      if (!outcome || outcome === "not_found") {
        res
          .writeHead(404, { "Content-Type": "application/json" })
          .end(JSON.stringify({ error: { code: 404, status: "NOT_FOUND" } }));
        return;
      }

      if (outcome === "unavailable") {
        res
          .writeHead(500, { "Content-Type": "application/json" })
          .end(JSON.stringify({ error: { message: "mock unavailable" } }));
        return;
      }

      res
        .writeHead(200, { "Content-Type": "application/json" })
        .end(JSON.stringify(toRawPlace(outcome)));
      return;
    }

    res.writeHead(404).end();
  }
}
