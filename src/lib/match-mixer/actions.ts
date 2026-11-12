"use server";

import * as liveMixers from "./live-mixers.ts";
import type { Outcome } from "./live-mixers.ts";
import { organizerLinkPath, playerLinkPath } from "./routes.ts";
import { createClient } from "./supabase/server.ts";

const SERVER_FAILED =
  "Match Mixer couldn't save the board just now, so it didn't go live. Your board is still here. Try again in a minute.";

/**
 * Go Live, the one call `/tools/match-mixer` makes over the network (ADR
 * 0006). Returns the two links' paths; the browser adds its own origin.
 */
export async function goLive(
  config: string,
): Promise<Outcome<{ organizerPath: string; playerPath: string }>> {
  if (typeof config !== "string") return { ok: false, problem: "That isn't a board." };
  let outcome: Awaited<ReturnType<typeof liveMixers.goLive>>;
  try {
    outcome = await liveMixers.goLive(await createClient(), config);
  } catch (error) {
    // Reached the server, failed behind it: not the organizer's signal.
    console.error(error);
    return { ok: false, problem: SERVER_FAILED };
  }
  if (!outcome.ok) return outcome;
  return {
    ok: true,
    value: {
      organizerPath: organizerLinkPath(outcome.value.organizerToken),
      playerPath: playerLinkPath(outcome.value.playerToken),
    },
  };
}
