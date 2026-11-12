"use client";

import { useEffect } from "react";

/**
 * Mic Drop's backstop (issue #671): anything that still throws, such as
 * starting a Poll with no signal, lands here instead of Next's bare
 * "Application error". Reload rather than `retry()`: after a redeploy only a
 * fresh page gets the new Server Actions.
 */
export default function MicDropError({ error }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="md-notice" role="alert">
      <h1>Lost the connection</h1>
      <p>Check your signal and reload. Votes and changes already saved are safe.</p>
      <button type="button" className="md-btn" onClick={() => window.location.reload()}>
        Reload
      </button>
    </div>
  );
}
