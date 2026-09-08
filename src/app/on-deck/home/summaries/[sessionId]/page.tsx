import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { pageMetadata } from "@/lib/metadata";
import { PageHeading } from "@/components/typography/page-heading";
import { verifyOrganizer } from "@/lib/on-deck/dal";
import { createClient } from "@/lib/on-deck/supabase/server";
import { getSessionSummary } from "@/lib/on-deck/summaries";
import { nightLabelWithYear } from "@/lib/on-deck/night-label";
import {
  courtRows,
  skillRows,
  utilizationSentence,
  waitConfidenceNote,
  waitRows,
} from "@/lib/on-deck/session/summary-format";
import { BarTable, StatTile } from "@/components/on-deck/summary-report";
import { ON_DECK_SUMMARIES_PATH, summaryPath } from "@/lib/on-deck/routes";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}): Promise<Metadata> {
  const { sessionId } = await params;
  return {
    ...pageMetadata({
      title: "On Deck session summary",
      description: "What one night left behind, once its players were forgotten.",
      path: summaryPath(sessionId),
    }),
    robots: { index: false, follow: false },
  };
}

/**
 * One night's Session Summary (issue #469).
 *
 * RLS scopes `on_deck_session_summaries` to the owning Organizer, so another
 * Club's night is simply absent and 404s here rather than needing a check of
 * its own. The same is true of a Session that never closed: a Summary is
 * written at close and at no other time, so there is nothing to read.
 */
export default async function OnDeckSummaryPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  await verifyOrganizer();
  const supabase = await createClient();

  const night = await getSessionSummary(supabase, sessionId).catch(() => null);
  if (!night) {
    notFound();
  }

  const { summary } = night;
  const { waitTime } = summary;

  return (
    <div className="od-summary flex w-full flex-1 flex-col">
      <section className="w-full px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-2xl flex-col gap-8">
          <div>
            <PageHeading
              eyebrow={night.venueName}
              title={nightLabelWithYear(night.startedAt)}
            />
            <p className="mt-3 text-sm text-muted-foreground">
              What this night left behind. The players themselves were not
              kept, because a closed session leaves numbers, not people.
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Played" value={String(summary.attendance)} />
            <StatTile label="Games" value={String(summary.gamesPlayed)} />
            <StatTile
              label="Longest wait"
              value={`${waitTime.longestWaitMin} min`}
            />
            <StatTile
              label="Average wait"
              value={`${waitTime.averageWaitMin} min`}
            />
          </dl>

          <p className="-mt-4 text-xs text-muted-foreground">
            {waitConfidenceNote(summary)}
          </p>

          <BarTable
            caption="How long people waited"
            note="Every completed wait, from joining the queue to walking onto a court."
            unit="waits"
            rows={waitRows(summary)}
          />

          <BarTable
            caption="How hard each court worked"
            note={utilizationSentence(summary)}
            unit="games"
            rows={courtRows(summary)}
          />

          <BarTable
            caption="Who was in the room"
            note="Self-declared, and never corrected by the app."
            unit="players"
            rows={skillRows(summary)}
          />

          <Link
            href={ON_DECK_SUMMARIES_PATH}
            className="text-sm underline underline-offset-4"
          >
            All past nights
          </Link>
        </div>
      </section>
    </div>
  );
}
