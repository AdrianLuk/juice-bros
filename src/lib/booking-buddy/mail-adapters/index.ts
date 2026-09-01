import "server-only";

import type { MailAdapter } from "../mail-adapter.ts";
import type { MailboxProvider } from "../mailbox-provider.ts";
import { googleMailAdapter } from "./google.ts";
import { microsoftMailAdapter } from "./microsoft.ts";

/**
 * The provider → adapter selection (spec #280): a plain `Record` literal, not
 * a class hierarchy or a dynamic registry, so a third provider later is one
 * new module plus one line here.
 */
export const mailAdapters: Record<MailboxProvider, MailAdapter> = {
  google: googleMailAdapter,
  microsoft: microsoftMailAdapter,
};

export function mailAdapterFor(provider: MailboxProvider): MailAdapter {
  return mailAdapters[provider];
}
