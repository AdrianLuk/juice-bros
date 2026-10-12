"use client";

import type { Freshness } from "@/lib/team-tally/live-sync";

/**
 * Said under a live screen's title once its reads stop landing (issue #661):
 * the scores shown may be behind. Past two minutes a reload is the way back
 * (after a redeploy nothing else is), so it offers one.
 */
export function StaleNote({ freshness }: { freshness?: Freshness }) {
  if (!freshness || freshness === "fresh") return null;
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
