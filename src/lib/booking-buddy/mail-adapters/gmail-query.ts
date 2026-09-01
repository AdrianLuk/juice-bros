import type { MailSearchCriteria } from "../mail-adapter.ts";

/**
 * Formats the provider-neutral `{ sender, after }` criteria into Gmail's
 * `users.messages.list` `q` syntax — one sender and a recency floor, never a
 * whole-inbox search (issue #62's Settings copy promises the User this).
 *
 * Its own relative-import-only module (no `server-only`, no `@/` imports) so
 * the exact `from:` / `after:YYYY/MM/DD` shape the live Gmail search depends on
 * stays covered by `node --test` — the Google adapter itself is only exercised
 * through the e2e mock, which ignores `q`.
 */
function formatGmailDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
}

export function toGmailSearchQuery(criteria: MailSearchCriteria): string {
  return `from:${criteria.sender} after:${formatGmailDate(criteria.after)}`;
}
