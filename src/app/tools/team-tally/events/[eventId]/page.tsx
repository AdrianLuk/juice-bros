import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { TtHead } from "@/components/team-tally/tt-head";
import { CopyBriefButton } from "@/components/team-tally/copy-brief-button";
import { absoluteAppUrl } from "@/lib/booking-buddy/request-origin";
import { pageMetadata } from "@/lib/metadata";
import { generateBrief } from "@/lib/team-tally/brief";
import { verifyOrganizer } from "@/lib/team-tally/dal";
import { briefInputFor, loadTeamEvent } from "@/lib/team-tally/events";
import { eventDateLabel } from "@/lib/team-tally/format";
import { TEAM_TALLY_ROOT, editTeamEventPath, teamEventPath } from "@/lib/team-tally/routes";
import { createClient } from "@/lib/team-tally/supabase/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ eventId: string }>;
}): Promise<Metadata> {
  const { eventId } = await params;
  return {
    ...pageMetadata({
      title: "Team Event brief",
      description: "The brief for a Team Tally night.",
      path: teamEventPath(eventId),
    }),
    robots: { index: false, follow: false },
  };
}

/** One Team Event, for its Organizer: the Brief, ready to copy. */
export default async function TeamEventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  await verifyOrganizer();
  const supabase = await createClient();
  const event = await loadTeamEvent(supabase, eventId);
  if (!event) notFound();

  const origin = await absoluteAppUrl("");
  const brief = generateBrief(briefInputFor(event, origin));

  return (
    <div className="flex w-full flex-1 flex-col">
      <TtHead
        title={event.name}
        meta={`${eventDateLabel(event.date)} · ${event.teams.length} Teams · ${event.matchups.length} Matchups`}
        actions={
          <>
            <CopyBriefButton brief={brief} />
            <Link href={editTeamEventPath(event.id)} className="tt-btn tt-btn-ghost">
              Edit setup
            </Link>
          </>
        }
      />

      <section className="tt-wrap pb-20 sm:pb-28">
        <div className="tt-sheet mx-auto max-w-3xl">
          <div className="tt-section-head">
            <h2 className="tt-h2">The brief</h2>
            <span className="tt-meta">For the group chat</span>
          </div>
          <pre aria-label="The brief" className="tt-brief">
            {brief}
          </pre>
        </div>
        <Link href={TEAM_TALLY_ROOT} className="tt-quietlink mx-auto mt-10 block w-fit">
          Back to your Team Events
        </Link>
      </section>
    </div>
  );
}
