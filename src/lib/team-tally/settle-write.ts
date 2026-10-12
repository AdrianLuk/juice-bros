/**
 * A write that never got an answer (no signal at the venue, a server error, a
 * redeploy that retired the Server Action) becomes a refusal the screen shows
 * on its problem line, instead of an error that takes the page down (issue
 * #659). The save may still have landed, so the message sends the captain to
 * reload and look. Relative imports only, for `node --test`.
 */

import type { WriteResult } from "./live-seam.ts";

export const UNANSWERED = "Couldn't reach Team Tally. Check your signal, then reload to see if it saved.";

export async function settleWrite(write: Promise<WriteResult>): Promise<WriteResult> {
  try {
    return await write;
  } catch {
    return { ok: false, problem: UNANSWERED };
  }
}
