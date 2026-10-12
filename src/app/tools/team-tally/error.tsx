"use client";

import { useEffect } from "react";

/**
 * Team Tally's backstop (issue #659): anything that still throws lands here
 * instead of Next's bare "Application error". Reload rather than `retry()`:
 * after a redeploy only a fresh page gets the new Server Actions.
 */
export default function TeamTallyError({ error }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="tt-wrap flex flex-1 flex-col justify-center py-16">
      <section className="tt-sheet flex flex-col items-start gap-4 p-6" role="alert">
        <h1 className="tt-title m-0">Lost the connection</h1>
        <p className="m-0">Check your signal and reload. Scores already saved are safe.</p>
        <button type="button" className="tt-btn" onClick={() => window.location.reload()}>
          Reload
        </button>
      </section>
    </div>
  );
}
