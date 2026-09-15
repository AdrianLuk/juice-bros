"use client";

import { useState } from "react";
import Link from "next/link";

import { ON_DECK_HOME_PATH } from "@/lib/on-deck/routes";

/**
 * The Club QR full-bleed (issue #517) — the code sized to fill a held-up
 * phone, for the door on a night the printed sign isn't there. Nothing here
 * is per-Session, same as the sign: the link the code carries always
 * resolves to whatever Session is open.
 *
 * `.od-sign` (`ClubQrSign`) stays exactly as it was — this is a second
 * surface, not a resize of that one, because the sign is drawn at paper
 * proportions on purpose and this view is not paper at all.
 */
export function ClubQrHoldUp({
  clubName,
  url,
  svg,
  message,
}: {
  clubName: string;
  url: string;
  svg: string;
  message: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="od-holdup">
      <Link
        href={ON_DECK_HOME_PATH}
        className="absolute top-4 left-4 text-xs text-neutral-500 underline underline-offset-4"
      >
        Back to Tonight
      </Link>

      <p className="od-holdup-club">{clubName}</p>

      <div
        role="img"
        aria-label={`Scan to join at ${url}`}
        className="od-holdup-qr"
        dangerouslySetInnerHTML={{ __html: svg }}
      />

      <button
        type="button"
        onClick={copy}
        className="rounded-full bg-brand-orange px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
      >
        {copied ? "Copied. Paste it in your group chat." : "Copy the join message"}
      </button>
    </div>
  );
}
