import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { pageMetadata } from "@/lib/metadata";
import { verifyOrganizer } from "@/lib/on-deck/dal";
import { createClient } from "@/lib/on-deck/supabase/server";
import { getSessionSummary } from "@/lib/on-deck/summaries";
import { sessionDateWithYear } from "@/lib/on-deck/session-date";
import {
  courtRows,
  skillRows,
  utilizationSentence,
  waitConfidenceNote,
  waitRows,
} from "@/lib/on-deck/session/summary-format";
import { BarTable, StatTile } from "@/components/on-deck/summary-report";
import { ArenaShell } from "@/components/on-deck/arena-shell";
import {
  BoardHead,
  Row,
  RowList,
  Stage,
} from "@/components/on-deck/back-office";
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
 * One Session's Summary (issue #469).
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

  const session = await getSessionSummary(supabase, sessionId).catch(
    () => null,
  );
  if (!session) {
    notFound();
  }

  const { summary } = session;
  const { waitTime } = summary;
  const seated = waitTime.sampleSize > 0;
  const waitNote = waitConfidenceNote(summary);

  return (
    <ArenaShell className="od-summary">
      <section className="w-full flex-1 px-5 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto w-full max-w-xl">
          <BoardHead
            name={sessionDateWithYear({
              at: session.startedAt,
              timeZone: session.timeZone,
            })}
            spec={[session.venueName]}
          />

          <p className="od-bo-note mt-6">
            What this night left behind. The players themselves were not kept,
            because a closed session leaves numbers, not people.
          </p>

          {session.autoClosed ? (
            <Stage tone="flat">
              <p className="od-bo-note">
                Nobody tapped Close. This session sat open with nothing
                happening long enough that On Deck closed it for you.
              </p>
            </Stage>
          ) : null}

          {/* The wait tiles carry their own sample size rather than leaving it
              to a line underneath. With nobody seated, `projectSummary`
              reports both waits as 0, and "Average wait 0 min" set in the same
              type as a real figure is exactly the false headline this page is
              supposed to avoid — so with no sample there is no number. */}
          <dl className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Played" value={String(summary.attendance)} />
            <StatTile label="Games" value={String(summary.gamesPlayed)} />
            <StatTile
              label="Longest wait"
              value={seated ? `${waitTime.longestWaitMin} min` : "—"}
              note={waitNote}
            />
            <StatTile
              label="Average wait"
              value={seated ? `${waitTime.averageWaitMin} min` : "—"}
              note={waitNote}
            />
          </dl>

          <div className="mt-7 flex flex-col gap-5">
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
          </div>

          <RowList>
            <Row href={ON_DECK_SUMMARIES_PATH} label="All past nights" />
          </RowList>
        </div>
      </section>
    </ArenaShell>
  );
}
