"use client";

import { isStale, type Freshness } from "@/lib/team-tally/live-sync";

/**
 * Said under a live screen's title once its reads stop landing (issue #661):
 * the scores shown may be behind. Once only a reload will bring it back
 * (after a redeploy nothing else does), it offers one.
 */
export function StaleNote({ freshness }: { freshness?: Freshness }) {
  if (!isStale(freshness)) return null;
  return (
    <p role="status" className="tt-stale m-0">
      {freshness === "reconnecting" ? (
        "Reconnecting… scores may be behind."
      ) : (
        <>
          Lost the connection.{" "}
          <button type="button" className="tt-quietlink" onClick={() => window.location.reload()}>
            Reload
          </button>
        </>
      )}
    </p>
  );
}
