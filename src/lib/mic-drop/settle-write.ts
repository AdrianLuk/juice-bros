/**
 * A Host's write that never got an answer (no signal, a server error, a
 * redeploy that retired the Server Action) becomes a refusal the screen shows
 * under the button, instead of an error that takes the page down (issue #671,
 * the same fix as Team Tally's #659). The write may still have landed, so the
 * message says to reload and look. Relative imports only, for `node --test`.
 */

import type { Outcome } from "./polls.ts";

export const UNANSWERED = "Couldn't reach Mic Drop. Check your signal, then reload to see if it saved.";

export async function settleWrite<T extends Outcome>(write: Promise<T>): Promise<T | { ok: false; problem: string }> {
  try {
    return await write;
  } catch {
    return { ok: false, problem: UNANSWERED };
  }
}
