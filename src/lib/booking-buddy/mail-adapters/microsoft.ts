import "server-only";

import type { MailAdapter } from "../mail-adapter.ts";

/**
 * Placeholder Microsoft `MailAdapter` — the `Record<MailboxProvider, MailAdapter>`
 * literal in `./index.ts` needs an entry for every provider, but the real
 * Microsoft implementation (OAuth against the `consumers` authority, Graph
 * `$filter` search) lands in #280's later slices. Until then `connectMailbox`
 * redirects `"microsoft"` straight to the connect-failure page and no Mailbox
 * Link is ever stored with `provider = 'microsoft'`, so none of this runs.
 *
 * The I/O methods still honour the interface's no-throw discriminated-result
 * contract — returning `unreachable` rather than throwing — so that a
 * `provider = 'microsoft'` row arriving by some path the app doesn't control
 * (a hand-written DB insert, a future migration) degrades to the ordinary
 * "couldn't reach your mailbox" path instead of an uncaught 500.
 * `buildAuthorizeUrl` has no result shape to return, and every caller already
 * catches it, so it throws.
 */
const NOT_WIRED_UP = "Microsoft mailbox support isn't wired up yet — see issue #280.";

const unreachable = () => Promise.resolve({ ok: false as const, reason: "unreachable" as const });

export const microsoftMailAdapter: MailAdapter = {
  buildAuthorizeUrl() {
    throw new Error(NOT_WIRED_UP);
  },
  exchangeCodeForTokens: unreachable,
  refreshAccessToken: unreachable,
  resolveAccountEmail: unreachable,
  searchMailbox: unreachable,
  fetchMessage: unreachable,
};
