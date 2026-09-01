import assert from "node:assert/strict";
import test from "node:test";

import { buildCourtReserveSearchCriteria, COURTRESERVE_SENDER } from "../courtreserve-email.ts";
import {
  buildGraphMessagesFilter,
  buildGraphMessagesUrl,
  collectGraphMessageIds,
  GRAPH_MESSAGES_MAX_PAGES,
  parseGraphMessagesPage,
} from "./graph-query.ts";

test("the Graph $filter scopes to the sender and a received-after floor", () => {
  const after = new Date("2026-05-19T12:00:00.000Z");
  const filter = buildGraphMessagesFilter({ sender: COURTRESERVE_SENDER, after });

  assert.equal(
    filter,
    `from/emailAddress/address eq '${COURTRESERVE_SENDER}' and receivedDateTime ge 2026-05-19T12:00:00.000Z`,
  );
});

test("a sender containing a quote is escaped, not left to break the filter", () => {
  const filter = buildGraphMessagesFilter({
    sender: "o'brien@example.com",
    after: new Date("2026-01-01T00:00:00.000Z"),
  });

  assert.match(filter, /eq 'o''brien@example\.com'/);
});

test("the first-page URL selects ids only, one bounded page, no $orderby", () => {
  const raw = buildGraphMessagesUrl(
    "https://graph.microsoft.com/v1.0",
    buildCourtReserveSearchCriteria(new Date("2026-08-17T12:00:00Z")),
  );
  const url = new URL(raw);

  assert.equal(url.pathname, "/v1.0/me/messages");
  assert.equal(url.searchParams.get("$select"), "id");
  assert.equal(url.searchParams.get("$orderby"), null);
  assert.equal(url.searchParams.get("$top"), "50");
  assert.match(url.searchParams.get("$filter") ?? "", new RegExp(`eq '${COURTRESERVE_SENDER}'`));

  // Spaces in the filter are %20-encoded, never `+` — Graph's OData parser
  // rejects `+`-for-space.
  assert.doesNotMatch(raw, /\$filter=[^&]*\+/);
  assert.match(raw, /%20/);
});

test("parsing a page pulls the ids and the nextLink", () => {
  const page = parseGraphMessagesPage({
    value: [{ id: "AAA" }, { id: "BBB" }, { notAnId: true }],
    "@odata.nextLink": "https://graph.microsoft.com/v1.0/me/messages?$skip=50",
  });

  assert.deepEqual(page.ids, ["AAA", "BBB"]);
  assert.equal(page.nextLink, "https://graph.microsoft.com/v1.0/me/messages?$skip=50");
});

test("a page with no value array is an empty page, not a crash", () => {
  assert.deepEqual(parseGraphMessagesPage({}), { ids: [], nextLink: null });
  assert.deepEqual(parseGraphMessagesPage(null), { ids: [], nextLink: null });
});

test("the pagination loop follows nextLink and concatenates ids across pages", async () => {
  const pages: Record<string, unknown> = {
    "page-1": { value: [{ id: "a" }, { id: "b" }], "@odata.nextLink": "page-2" },
    "page-2": { value: [{ id: "c" }], "@odata.nextLink": "page-3" },
    "page-3": { value: [{ id: "d" }] },
  };

  const result = await collectGraphMessageIds("page-1", (url) => Promise.resolve(pages[url] ?? null));

  assert.deepEqual(result, { ok: true, ids: ["a", "b", "c", "d"] });
});

test("the pagination loop stops at the page cap even if nextLink never ends", async () => {
  let fetches = 0;
  const result = await collectGraphMessageIds("loop", () => {
    fetches++;
    return Promise.resolve({ value: [{ id: `m${fetches}` }], "@odata.nextLink": "loop" });
  });

  assert.equal(fetches, GRAPH_MESSAGES_MAX_PAGES);
  assert.deepEqual(result, { ok: true, ids: ["m1", "m2", "m3", "m4", "m5"] });
});

test("a failed page fails the whole search rather than returning a partial list", async () => {
  const result = await collectGraphMessageIds("page-1", (url) =>
    Promise.resolve(url === "page-1" ? { value: [{ id: "a" }], "@odata.nextLink": "page-2" } : null),
  );

  assert.deepEqual(result, { ok: false });
});
