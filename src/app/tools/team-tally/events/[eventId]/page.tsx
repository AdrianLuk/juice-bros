import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHead } from "@/components/bx/page-head";
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
      <PageHead
        title={event.name}
        meta={`${eventDateLabel(event.date)} · ${event.teams.length} Teams · ${event.matchups.length} Matchups`}
        actions={
          <>
            <CopyBriefButton brief={brief} />
            <Link href={editTeamEventPath(event.id)} className="bx-btn bx-btn-ghost">
              Edit setup
            </Link>
          </>
        }
      />

      <section className="bx-measure pb-20 sm:pb-28">
        <h2 className="bx-meta">The brief</h2>
        <pre
          aria-label="The brief"
          className="bx-panel mt-3 overflow-x-auto p-5 font-sans text-[0.9375rem] leading-relaxed whitespace-pre-wrap break-words text-(--bx-ink) sm:p-8"
        >
          {brief}
        </pre>
        <Link href={TEAM_TALLY_ROOT} className="bx-quietlink mt-10 inline-block">
          Back to your Team Events
        </Link>
      </section>
    </div>
  );
}
