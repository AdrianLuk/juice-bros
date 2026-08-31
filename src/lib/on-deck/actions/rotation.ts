"use server";

import { loadRotationView, type RotationView } from "../rotation.ts";

export type { RotationCourt, RotationView } from "../rotation.ts";

/**
 * The Server Action the live surfaces poll (issue #243). Thin wrapper over
 * `loadRotationView` so client components have something to call; the
 * projection and the token-privacy rules live in `../rotation.ts`.
 */
export async function getRotationView(
  sessionId: string,
  token?: string,
): Promise<RotationView | null> {
  return loadRotationView(sessionId, token);
}
