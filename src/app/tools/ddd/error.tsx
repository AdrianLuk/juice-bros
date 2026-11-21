"use client";

import { useEffect } from "react";

/**
 * DDD's backstop: anything that still throws lands here instead of Next's
 * bare "Application error". Reload rather than `retry()`: after a redeploy
 * only a fresh page gets the new Server Actions.
 */
export default function DddError({ error }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="ddd-main">
      <div className="ddd-col ddd-slip ddd-notice" role="alert">
        <p className="ddd-slip-head">Lost the connection</p>
        <p>Check your signal and reload. Anything already saved is safe.</p>
        <button type="button" className="ddd-btn" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    </main>
  );
}
