import type { MailSearchCriteria } from "../mail-adapter.ts";

/**
 * The Microsoft Graph counterpart of `gmail-query.ts` — turns the
 * provider-neutral `{ sender, after }` criteria into the `$filter` /
 * `$select` / `$orderby` / `$top` query the Outlook adapter runs against
 * `GET /me/messages`, and reads one page of that response back into a
 * `{ ids, nextLink }` pair.
 *
 * Its own relative-import-only module (no `server-only`, no `@/` imports) so
 * the exact `$filter` shape the live Graph search depends on, and the
 * `@odata.nextLink` pagination loop, stay covered by `node --test` — the
 * Microsoft adapter itself is only exercised through the e2e mock, which
 * ignores the query string, the same split `gmail-query.ts` documents.
 */

/**
 * How many `@odata.nextLink` hops `searchMailbox` follows before it stops.
 * A hobby-app inbox with a single sender and a 90-day floor never fills one
 * page, let alone five — the cap is only there so a Graph bug (or a
 * self-referential `nextLink`) can't spin the loop forever.
 */
export const GRAPH_MESSAGES_MAX_PAGES = 5;

/** Page size requested via `$top` — Graph's own default is 10, which would page needlessly. */
export const GRAPH_MESSAGES_PAGE_SIZE = 50;

/**
 * Graph's OData `$filter` expects `''`-quoted string literals; a sender
 * address realistically never contains a quote, but double any that appear
 * rather than emit a broken filter.
 */
function odataQuote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * "from the CourtReserve sender, received at or after the window floor" — the
 * `receivedDateTime` bound is a plain ISO-8601 instant, which Graph compares
 * directly.
 */
export function buildGraphMessagesFilter(criteria: MailSearchCriteria): string {
  return (
    `from/emailAddress/address eq ${odataQuote(criteria.sender)}` +
    ` and receivedDateTime ge ${criteria.after.toISOString()}`
  );
}

/**
 * The full first-page URL: ids only (`$select=id`), one bounded page.
 * `baseUrl` is the Graph origin + version prefix
 * (`https://graph.microsoft.com/v1.0` in production, the e2e mock's own base
 * in tests).
 *
 * No `$orderby`: Graph already returns messages newest-first by default, and
 * combining `$orderby=receivedDateTime` with a `$filter` whose first property
 * isn't `receivedDateTime` is rejected outright ("The restriction or sort
 * order is too complex for this operation"). The review pipeline re-sorts by
 * each email's own timestamp anyway (`reconcileCourtReserveEvents`), so the
 * page order only has to be "recent-ish", which the default already is.
 *
 * The query string is assembled by hand rather than via `URLSearchParams`:
 * that encodes a space as `+`, and Graph's OData `$filter` parser does not
 * reliably accept `+`-for-space — `encodeURIComponent` emits `%20`, which it
 * does.
 */
export function buildGraphMessagesUrl(baseUrl: string, criteria: MailSearchCriteria): string {
  const query = [
    `$filter=${encodeURIComponent(buildGraphMessagesFilter(criteria))}`,
    `$select=id`,
    `$top=${GRAPH_MESSAGES_PAGE_SIZE}`,
  ].join("&");
  return `${baseUrl}/me/messages?${query}`;
}

/**
 * One `/me/messages` page reduced to the message ids it lists and the
 * absolute `@odata.nextLink` to follow for the next page (`null` when Graph
 * omits it — the last page). A response with no `value` array at all is
 * treated as an empty page, not a failure, matching how the Gmail adapter
 * treats a missing `messages` key.
 */
export function parseGraphMessagesPage(json: unknown): { ids: string[]; nextLink: string | null } {
  if (typeof json !== "object" || json === null) {
    return { ids: [], nextLink: null };
  }

  const record = json as { value?: unknown; "@odata.nextLink"?: unknown };
  const value = Array.isArray(record.value) ? record.value : [];
  const ids = value
    .map((entry) =>
      typeof entry === "object" && entry !== null ? (entry as { id?: unknown }).id : undefined,
    )
    .filter((id): id is string => typeof id === "string");

  const nextLink = typeof record["@odata.nextLink"] === "string" ? record["@odata.nextLink"] : null;

  return { ids, nextLink };
}

/**
 * The `@odata.nextLink` loop, dependency-injected so it stays pure: given the
 * first-page URL and a `fetchPage` that returns each page's parsed JSON (or
 * `null` when a page couldn't be reached), walk pages until there's no
 * `nextLink`, `fetchPage` fails, or `GRAPH_MESSAGES_MAX_PAGES` is hit.
 *
 * A failed page is reported as `{ ok: false }` rather than returning a
 * partial list — a sync that silently dropped half the inbox would settle
 * (and never re-show) messages it never actually saw.
 */
export async function collectGraphMessageIds(
  firstUrl: string,
  fetchPage: (url: string) => Promise<unknown | null>,
): Promise<{ ok: true; ids: string[] } | { ok: false }> {
  const ids: string[] = [];
  let url: string | null = firstUrl;

  for (let page = 0; page < GRAPH_MESSAGES_MAX_PAGES && url !== null; page++) {
    const json = await fetchPage(url);
    if (json === null) {
      return { ok: false };
    }

    const parsed = parseGraphMessagesPage(json);
    ids.push(...parsed.ids);
    url = parsed.nextLink;
  }

  return { ok: true, ids };
}
