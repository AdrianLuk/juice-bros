"use client";

import { useState } from "react";

/**
 * The Organizer's view-and-copy of the open Session's Volunteer Link (issue
 * #248). The absolute `url` is resolved on the server (from the request host),
 * so this component only owns the copy interaction.
 */
export function VolunteerLinkCard({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="od-panel p-4">
      <h2 className="od-readout text-[0.72rem] text-arena-dim">Volunteer link</h2>
      <p className="mt-1.5 text-sm text-arena-faint">
        Share this with tonight&apos;s volunteers. It opens the floor screen with
        no login and stops working once the session closes.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <code
          className="min-w-0 flex-1 truncate rounded-md border border-arena-line bg-arena-bg px-2.5 py-2 font-mono text-xs text-arena-dim"
          data-testid="volunteer-link"
        >
          {url}
        </code>
        <button type="button" className="od-key od-key--ghost" onClick={copy}>
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
    </div>
  );
}
