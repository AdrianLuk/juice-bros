import type { PushResult } from "./deliver.ts";

/**
 * What a web-push throw means for the device. A 404 or 410 is the push service
 * saying it has dropped the device: `gone`, and `deliver` forgets it. Anything
 * else, a 5xx or a network failure with no status at all, is an `error` and
 * the device is kept for the next run.
 *
 * Kept out of `web-push-sender.ts` (which is `server-only`) so `node --test`
 * can reach it.
 */
export function pushResultForError(error: unknown): PushResult {
  const statusCode =
    typeof error === "object" && error !== null && "statusCode" in error
      ? error.statusCode
      : undefined;
  return statusCode === 404 || statusCode === 410 ? { status: "gone" } : { status: "error", error };
}
