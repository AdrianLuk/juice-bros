import type { Metadata } from "next";

import { pageMetadata } from "@/lib/metadata";
import { verifyOrganizer } from "@/lib/on-deck/dal";
import { createClient } from "@/lib/on-deck/supabase/server";
import { getOwnedClub } from "@/lib/on-deck/clubs";
import { getSummariesForClub } from "@/lib/on-deck/summaries";
import { ON_DECK_SUMMARIES_PATH, summaryPath } from "@/lib/on-deck/routes";
import { sessionDate } from "@/lib/on-deck/session-date";
import { ArenaShell } from "@/components/on-deck/arena-shell";
import {
  BackToTonight,
  BoardHead,
  Row,
  RowList,
  Stage,
} from "@/components/on-deck/back-office";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "On Deck past nights",
    description: "Every closed session, and the numbers each one left behind.",
    path: ON_DECK_SUMMARIES_PATH,
  }),
  robots: { index: false, follow: false },
};

/**
 * Past nights (issue #469; on the board since #515) — the reader's word for
 * closed Sessions, which the glossary permits in product copy the way it
 * permits "Social". One row per closed Session, most recent first, the order
 * the `(club_id, session_closed_at desc)` index exists for.
 *
 * The same row the home screen shows its three most recent in, so a night
 * looks the same wherever it is listed.
 *
 * The headline numbers come from the denormalised columns rather than from
 * unpacking every Summary's JSONB, which is what those columns were put there
 * for.
 */
export default async function OnDeckSummariesPage() {
  await verifyOrganizer();
  const supabase = await createClient();
  const club = await getOwnedClub(supabase);
  const sessions = club ? await getSummariesForClub(supabase, club.id) : [];

  return (
    <ArenaShell>
      <section className="w-full flex-1 px-5 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto w-full max-w-xl">
          <BoardHead
            name="Past nights"
            spec={
              sessions.length > 0
                ? [`${sessions.length} ${sessions.length === 1 ? "night" : "nights"}`]
                : []
            }
          />

          {sessions.length === 0 ? (
            <Stage tone="flat">
              <p className="od-bo-note">
                No nights have finished yet. A session leaves its numbers here
                the moment you close it: how many played, how many games, how
                long people waited, and the mix of levels in the room. The
                players themselves are not kept.
              </p>
            </Stage>
          ) : (
            <RowList>
              {sessions.map((session) => (
                <Row
                  key={session.sessionId}
                  href={summaryPath(session.sessionId)}
                  label={sessionDate({
                    at: session.startedAt,
                    timeZone: session.timeZone,
                  })}
                  sub={
                    session.autoClosed
                      ? `${session.venueName} · closed automatically`
                      : session.venueName
                  }
                  value={`${session.attendance} played · ${session.gamesPlayed} games`}
                />
              ))}
            </RowList>
          )}

          <BackToTonight />
        </div>
      </section>
    </ArenaShell>
  );
}
