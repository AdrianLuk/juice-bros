"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

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
    <div className="rounded-2xl border bg-card p-4">
      <h2 className="font-heading text-lg font-semibold">Volunteer link</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Share this with tonight&apos;s volunteers. It opens the floor screen with
        no login and stops working once the session closes.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <code
          className="min-w-0 flex-1 truncate rounded-md border bg-background px-2 py-1.5 text-xs"
          data-testid="volunteer-link"
        >
          {url}
        </code>
        <Button type="button" size="sm" variant="outline" onClick={copy}>
          {copied ? "Copied" : "Copy link"}
        </Button>
      </div>
    </div>
  );
}
