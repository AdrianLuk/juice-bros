"use client";

import type { LiveView } from "@/lib/team-tally/live-seam";
import { OrganizerScreen } from "./organizer-screen";
import { PublicScreen } from "./public-screen";
import { QueryProvider } from "./query-provider";
import { ScoreLinkScreen } from "./score-link-screen";
import { useServerSeam } from "./server-seam";
import type { PublicView } from "./tv-stage";
import { useLiveEvent } from "./use-live-event";

/**
 * The live screens on a real night: each screen wired to the real adapter of
 * the live seam (`useServerSeam`, issue #631), the server's first read kept
 * current by Realtime and every write a Server Action. The demo night wires
 * the same screens to its in-memory adapter instead (`demo-stage.tsx`).
 */

/** A captain's Score Link. No account; the token is the credential. */
export function ScoreLinkBoard({ token, initial }: { token: string; initial: LiveView }) {
  return (
    <QueryProvider>
      <ScoreLinkLive token={token} initial={initial} />
    </QueryProvider>
  );
}

function ScoreLinkLive({ token, initial }: { token: string; initial: LiveView }) {
  const live = useServerSeam({ kind: "score", token }, initial);
  return <ScoreLinkScreen live={live} myTeamId={live.view.myTeamId ?? initial.myTeamId!} />;
}

/** The signed-in Organizer's running night. */
export function OrganizerBoard({ eventId, initial }: { eventId: string; initial: LiveView }) {
  return (
    <QueryProvider>
      <OrganizerLive eventId={eventId} initial={initial} />
    </QueryProvider>
  );
}

function OrganizerLive({ eventId, initial }: { eventId: string; initial: LiveView }) {
  return <OrganizerScreen live={useServerSeam({ kind: "organizer", eventId }, initial)} />;
}

/** The read-only Public Link: phone, laptop or venue TV. */
export function PublicBoard({
  token,
  initial,
  view = "auto",
  screen,
}: {
  token: string;
  initial: LiveView;
  view?: PublicView;
  screen?: string;
}) {
  return (
    <QueryProvider>
      <PublicLive token={token} initial={initial} view={view} screen={screen} />
    </QueryProvider>
  );
}

function PublicLive({
  token,
  initial,
  view,
  screen,
}: {
  token: string;
  initial: LiveView;
  view: PublicView;
  screen?: string;
}) {
  const { view: live } = useLiveEvent({ kind: "public", token }, initial);
  return <PublicScreen live={{ view: live }} view={view} screen={screen} />;
}
