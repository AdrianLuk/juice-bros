import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { TtHead } from "@/components/team-tally/tt-head";
import { SetupForm } from "@/components/team-tally/setup-form";
import { pageMetadata } from "@/lib/metadata";
import { verifyOrganizer } from "@/lib/team-tally/dal";
import { loadTeamEvent } from "@/lib/team-tally/events";
import { editTeamEventPath, teamEventPath } from "@/lib/team-tally/routes";
import { createClient } from "@/lib/team-tally/supabase/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ eventId: string }>;
}): Promise<Metadata> {
  const { eventId } = await params;
  return {
    ...pageMetadata({
      title: "Edit Team Event",
      description: "Change a team night's teams and Matchups.",
      path: editTeamEventPath(eventId),
    }),
    robots: { index: false, follow: false },
  };
}

export default async function EditTeamEventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  await verifyOrganizer();
  const supabase = await createClient();
  const event = await loadTeamEvent(supabase, eventId);
  if (!event) notFound();

  return (
    <div className="flex w-full flex-1 flex-col">
      <TtHead
        title={`Edit ${event.name}`}
        lead="Score Links already in the brief keep working after you save."
      />
      <section className="tt-wrap pb-20 sm:pb-28">
        <SetupForm
          eventId={event.id}
          defaultDate={event.date}
          initial={{
            name: event.name,
            date: event.date,
            // Score Link tokens stay on the server; the form needs only ids.
            teams: event.teams.map((team) => ({
              id: team.id,
              nickname: team.nickname,
              captain: team.captain,
              slotA: team.slotA,
              slotB: team.slotB,
              slotC: team.slotC,
              homeCourt: team.homeCourt,
            })),
            matchups: event.matchups,
          }}
        />
        <Link href={teamEventPath(event.id)} className="tt-quietlink mt-10 inline-block">
          Back to the brief
        </Link>
      </section>
    </div>
  );
}
