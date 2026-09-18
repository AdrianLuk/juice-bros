"use client";

import { buildJoinMessage } from "@/lib/on-deck/join-message";
import { useCopyToClipboard } from "@/components/on-deck/use-copy-to-clipboard";

/**
 * The join message again, once the first-night kit (issue #521) has dropped
 * off home. The kit only shows before a Club's *first* close, so this is
 * where the same wording resurfaces for the ordinary weekly rhythm — the same
 * message `FirstNightKit` builds, off the same stable Club QR link (never a
 * per-Session one), so posting it again next week is never stale.
 */
export function NextWeekMessage({
  clubName,
  joinUrl,
}: {
  clubName: string;
  joinUrl: string;
}) {
  const message = buildJoinMessage(clubName, joinUrl);
  const { copied, copy } = useCopyToClipboard(message);

  return (
    <div className="od-panel od-bo-stage" data-testid="next-week-message">
      <p className="od-bo-note">
        Getting ready for next week? Pin this in the group chat again if it
        has fallen down the feed.
      </p>
      <button type="button" className="od-key od-key--ghost" onClick={copy}>
        {copied ? "Copied" : "Copy the join message"}
      </button>
    </div>
  );
}
