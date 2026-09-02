import { NextResponse } from "next/server";

import {
  setCalendarFeedUrl,
  clearCalendarFeedUrl,
  syncFacilityFeeds,
  syncFacilityFeed,
  confirmFeedCandidate,
  dismissFeedCandidate,
} from "@/lib/booking-buddy/actions/calendar-feed";
import { confirmImportCandidate } from "@/lib/booking-buddy/actions/email-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A test-only bridge for the Calendar Feed integration spec
 * (`e2e/calendar-feed.spec.ts`).
 *
 * Issue #294 ships the Calendar Feed *backend* — the server actions — with the
 * user-facing screens deferred to the next ticket, so there is no button for
 * Playwright to click. This route lets the spec drive the real server actions
 * with the browser's own signed-in session (the actions all start at
 * `verifySession`, which reads the session cookie the spec's `signIn` set), so
 * the integration test exercises the genuine set-URL → sync → confirm → Booking
 * path rather than a stub.
 *
 * Inert everywhere else: it 404s unless `E2E_WEB_SERVER=1`, the same guard
 * `/api/e2e-preflight` uses — nothing but `playwright.config.ts`'s
 * `webServer.env` ever sets it, so it cannot be reached on a real deploy.
 * Delete it (and this route folder) when the Calendar Feed UI ticket lands and
 * the spec can click real buttons.
 */
export async function POST(request: Request) {
  if (process.env.E2E_WEB_SERVER !== "1") {
    return new NextResponse("Not found", { status: 404 });
  }

  const payload = (await request.json()) as {
    action: string;
    fields?: Record<string, string>;
    orgId?: string;
  };

  const formData = new FormData();
  for (const [key, value] of Object.entries(payload.fields ?? {})) {
    formData.set(key, value);
  }

  const noPrev = {} as never;

  switch (payload.action) {
    case "setCalendarFeedUrl":
      return NextResponse.json(await setCalendarFeedUrl(noPrev, formData));
    case "clearCalendarFeedUrl":
      return NextResponse.json(await clearCalendarFeedUrl(noPrev, formData));
    case "syncFacilityFeeds":
      return NextResponse.json(await syncFacilityFeeds());
    case "syncFacilityFeed":
      return NextResponse.json(await syncFacilityFeed(payload.orgId ?? ""));
    case "confirmFeedCandidate":
      return NextResponse.json(await confirmFeedCandidate(noPrev, formData));
    case "dismissFeedCandidate":
      return NextResponse.json(await dismissFeedCandidate(noPrev, formData));
    case "confirmImportCandidate":
      return NextResponse.json(await confirmImportCandidate(noPrev, formData));
    default:
      return new NextResponse("unknown action", { status: 400 });
  }
}
