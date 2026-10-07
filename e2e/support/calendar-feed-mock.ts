import http from "node:http";

import type { AddressInfo } from "node:net";

/**
 * A fixture ICS feed server for the Calendar Feed suite (issue #294) — the
 * `.ics` counterpart of `gmail-mock.ts`. It serves a raw calendar body per
 * path and can simulate the failure modes the SSRF-hardened fetch has to
 * survive: a 5xx, an empty body, a malformed body, an oversized body, and a
 * redirect.
 *
 * OS-assigned port, unlike the Places / Gmail / Microsoft mocks. Those ports
 * are baked into the app's env before it boots; this one never is. The app
 * only allows the host (`CALENDAR_FEED_ALLOWED_HOSTS=127.0.0.1` in
 * `playwright.config.ts`), and each test pastes the full feed URL, port and
 * all. So every spec gets its own server, and calendar-feed and sync-bookings
 * can run on two workers at once without fighting over a port.
 *
 * Unlike the OAuth mocks there is no auth here — a CourtReserve feed URL is a
 * bare GET carrying its member token in the path, and the SSRF guard's whole
 * point is that the app sends no cookies or auth headers. The server asserts
 * that: a request arriving with a `Cookie` or `Authorization` header is a test
 * failure, surfaced as a 400 so the spec sees it.
 */
export const CALENDAR_FEED_MOCK_HOST = "127.0.0.1";

type FeedResponse =
  | { kind: "ics"; body: string }
  | { kind: "status"; status: number }
  | { kind: "empty" }
  /** A well-formed VCALENDAR with no VEVENT in it — a member with nothing booked (#431). */
  | { kind: "no-events" }
  | { kind: "malformed" }
  | { kind: "oversized" }
  | { kind: "redirect"; location: string };

export class CalendarFeedMock {
  #server: http.Server;
  /** path (`/feed/abc`) -> what to serve for it. */
  #feeds = new Map<string, FeedResponse>();

  constructor() {
    this.#server = http.createServer((req, res) => {
      try {
        this.#handle(req, res);
      } catch (error) {
        console.error("calendar-feed-mock: request handling failed", error);
        res.writeHead(500).end();
      }
    });
  }

  async start(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.#server.once("error", reject);
      this.#server.listen(0, CALENDAR_FEED_MOCK_HOST, () => resolve());
    });
  }

  /** `http://127.0.0.1:<port>`, once `start()` has bound a port. */
  get #baseUrl(): string {
    const { port } = this.#server.address() as AddressInfo;
    return `http://${CALENDAR_FEED_MOCK_HOST}:${port}`;
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.#server.close((error) => (error ? reject(error) : resolve()));
    });
  }

  reset(): void {
    this.#feeds.clear();
  }

  /**
   * The full URL a test hands to `setCalendarFeedUrl` for a given feed path.
   * Plain `http://` on 127.0.0.1: `CALENDAR_FEED_ALLOWED_HOSTS` (set in
   * `playwright.config.ts`) is what lets `validateFeedUrl` accept an `http:`
   * URL for this one host — the same `https:`→`http:` downgrade
   * `GMAIL_API_BASE_URL` carries for the Gmail mock.
   */
  urlFor(path: string): string {
    return `${this.#baseUrl}${path}`;
  }

  registerFeed(path: string, response: FeedResponse): void {
    this.#feeds.set(path, response);
  }

  #handle(req: http.IncomingMessage, res: http.ServerResponse): void {
    if (req.headers.cookie || req.headers.authorization) {
      res
        .writeHead(400, { "Content-Type": "text/plain" })
        .end("calendar-feed-mock: request carried a Cookie/Authorization header — SSRF guard regression");
      return;
    }

    const url = new URL(req.url ?? "/", this.#baseUrl);
    const feed = this.#feeds.get(url.pathname);

    if (!feed) {
      res.writeHead(404, { "Content-Type": "text/plain" }).end("no such feed");
      return;
    }

    switch (feed.kind) {
      case "ics":
        res.writeHead(200, { "Content-Type": "text/calendar; charset=utf-8" }).end(feed.body);
        return;
      case "status":
        res.writeHead(feed.status).end();
        return;
      case "empty":
        res.writeHead(200, { "Content-Type": "text/calendar" }).end("");
        return;
      case "no-events":
        res
          .writeHead(200, { "Content-Type": "text/calendar; charset=utf-8" })
          .end(
            ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//CourtReserve//EN", "END:VCALENDAR"].join(
              "\r\n",
            ),
          );
        return;
      case "malformed":
        res
          .writeHead(200, { "Content-Type": "text/calendar" })
          .end("this is not a calendar at all\nrandom junk\n");
        return;
      case "oversized": {
        // Just over the 5 MiB client cap.
        res.writeHead(200, { "Content-Type": "text/calendar" });
        const chunk = "X".repeat(64 * 1024);
        for (let sent = 0; sent < 6 * 1024 * 1024; sent += chunk.length) {
          res.write(chunk);
        }
        res.end();
        return;
      }
      case "redirect":
        res.writeHead(302, { Location: feed.location }).end();
        return;
      default: {
        const _exhaustive: never = feed;
        void _exhaustive;
        res.writeHead(500).end();
      }
    }
  }
}

/**
 * A minimal but real CourtReserve-shaped VCALENDAR body: one timed VEVENT per
 * entry, `SUMMARY` the format word, `DESCRIPTION` the court, `LOCATION` the
 * club. Datetimes are emitted as trailing-`Z` UTC instants.
 */
export function icsBody(
  events: {
    uid: string;
    summary: string;
    description: string;
    location: string;
    /** ISO instant, e.g. from `torontoInstant` (support/dates.ts). */
    start: string;
    end: string;
    sequence?: number;
    status?: "CANCELLED";
  }[],
): string {
  const toIcsInstant = (iso: string) =>
    `${iso.replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z")}`;

  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//CourtReserve//EN", "CALSCALE:GREGORIAN"];
  for (const event of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.uid}`,
      `SEQUENCE:${event.sequence ?? 0}`,
      `DTSTART:${toIcsInstant(event.start)}`,
      `DTEND:${toIcsInstant(event.end)}`,
      `SUMMARY:${event.summary}`,
      `DESCRIPTION:${event.description}`,
      `LOCATION:${event.location}`,
    );
    if (event.status) {
      lines.push(`STATUS:${event.status}`);
    }
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
