import assert from "node:assert/strict";
import test from "node:test";

import { buildCourtReserveSearchCriteria, COURTRESERVE_SENDER } from "../courtreserve-email.ts";
import { toGmailSearchQuery } from "./gmail-query.ts";

test("the Gmail query scopes to the sender and a recency floor, never the whole inbox", () => {
  const after = new Date("2026-05-19T12:00:00Z");
  const query = toGmailSearchQuery({ sender: COURTRESERVE_SENDER, after });

  const yyyy = after.getFullYear();
  const mm = String(after.getMonth() + 1).padStart(2, "0");
  const dd = String(after.getDate()).padStart(2, "0");
  assert.equal(query, `from:${COURTRESERVE_SENDER} after:${yyyy}/${mm}/${dd}`);
});

test("the CourtReserve criteria format to Gmail's from:/after: shape", () => {
  const now = new Date("2026-08-17T12:00:00Z");
  const query = toGmailSearchQuery(buildCourtReserveSearchCriteria(now));

  assert.match(query, new RegExp(`^from:${COURTRESERVE_SENDER.replace(".", "\\.")} after:\\d{4}/\\d{2}/\\d{2}$`));
});
