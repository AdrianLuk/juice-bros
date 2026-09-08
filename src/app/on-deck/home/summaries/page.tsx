import type { Metadata } from "next";
import Link from "next/link";

import { pageMetadata } from "@/lib/metadata";
import { PageHeading } from "@/components/typography/page-heading";
import { verifyOrganizer } from "@/lib/on-deck/dal";
import { createClient } from "@/lib/on-deck/supabase/server";
import { getOwnedClub } from "@/lib/on-deck/clubs";
import { getSummariesForClub } from "@/lib/on-deck/summaries";
import {
  ON_DECK_HOME_PATH,
  ON_DECK_SUMMARIES_PATH,
  summaryPath,
} from "@/lib/on-deck/routes";
import { nightLabel } from "@/lib/on-deck/night-label";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "On Deck past nights",
    description: "Every closed session, and the numbers each one left behind.",
    path: ON_DECK_SUMMARIES_PATH,
  }),
  robots: { index: false, follow: false },
};

/**
 * Past nights (issue #469). One row per closed Session, most recent first —
 * the order the `(club_id, session_closed_at desc)` index exists for.
 *
 * The headline numbers come from the denormalised columns rather than from
 * unpacking every Summary's JSONB, which is what those columns were put there
 * for.
 */
export default async function OnDeckSummariesPage() {
  await verifyOrganizer();
  const supabase = await createClient();
  const club = await getOwnedClub(supabase);
  const summaries = club ? await getSummariesForClub(supabase, club.id) : [];

  return (
    <div className="flex w-full flex-1 flex-col">
      <section className="w-full px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <PageHeading eyebrow={club?.name ?? "On Deck"} title="Past nights" />

          {summaries.length === 0 ? (
            <div className="mt-8 rounded-2xl border bg-card p-6">
              <p className="text-sm text-muted-foreground">
                No nights have finished yet. A session leaves its numbers here
                the moment you close it: how many played, how many games, how
                long people waited, and the mix of levels in the room. The
                players themselves are not kept.
              </p>
              <Link
                href={ON_DECK_HOME_PATH}
                className="mt-4 inline-block text-sm underline underline-offset-4"
              >
                Back to Tonight
              </Link>
            </div>
          ) : (
            <>
              <ul className="mt-8 flex flex-col gap-3">
                {summaries.map((night) => (
                  <li key={night.sessionId}>
                    <Link
                      href={summaryPath(night.sessionId)}
                      className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-2xl border bg-card p-5 transition-colors hover:bg-muted"
                    >
                      <span className="flex flex-col gap-0.5">
                        <span className="font-medium">
                          {nightLabel(night.startedAt)}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {night.venueName}
                        </span>
                      </span>
                      <span className="text-sm tabular-nums text-muted-foreground">
                        {night.attendance} played, {night.gamesPlayed} games
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>

              <Link
                href={ON_DECK_HOME_PATH}
                className="mt-8 inline-block text-sm underline underline-offset-4"
              >
                Back to Tonight
              </Link>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
