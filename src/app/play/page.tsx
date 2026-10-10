import type { Metadata } from "next";

import { PageHead } from "@/components/bx/page-head";
import { RallyGame } from "@/components/apps/rally/rally-game";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Play: Pickleball Game",
  description:
    "A short pickleball game in your browser. Play as Adrian or Daven from Juice Bros against the other host. Side-out scoring, first to 11.",
  path: "/play",
});

const HINT_ID = "rally-hint";

/**
 * The Rally game, ported from Adrian's portfolio: you pick a host and play
 * the other one. The heading and the controls hint are plain server-rendered
 * text; the court and the game's own UI are the client component, which
 * loads Three.js after the first paint.
 */
export default function PlayPage() {
  return (
    <div className="flex w-full flex-1 flex-col">
      <PageHead
        title="Take on one of the hosts"
        lead="Pick Adrian or Daven and play a game against the other one. Your swing is automatic, so all you have to do is get to the ball."
      />
      <div className="bx-measure pb-20 sm:pb-28">
        <RallyGame describedBy={HINT_ID} />
        <div id={HINT_ID} className="mt-5 space-y-1 text-[0.9375rem] text-(--bx-muted)">
          <p>Keyboard: arrow keys move, Space serves, and holding Space dinks. Esc or P pauses.</p>
          <p>Phone: drag anywhere on the court to move and tap to serve. Hold Dink to dink.</p>
        </div>
      </div>
    </div>
  );
}
