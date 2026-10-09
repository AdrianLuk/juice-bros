import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { apps } from "@/data/apps";
import { TeamTallyLanding } from "@/components/team-tally/landing/landing";
import { TtHead } from "@/components/team-tally/tt-head";
import { pageMetadata } from "@/lib/metadata";
import { buildAppPageJsonLd, toJsonLdScript } from "@/lib/structured-data";
import { signOut } from "@/lib/team-tally/actions/auth";
import { getOptionalOrganizer } from "@/lib/team-tally/dal";
import { listTeamEvents } from "@/lib/team-tally/events";
import { eventDateLabel, eventDateParts } from "@/lib/team-tally/format";
import { TEAM_TALLY_NEW_EVENT_PATH, teamEventPath } from "@/lib/team-tally/routes";
import { createClient } from "@/lib/team-tally/supabase/server";

const app = apps.find((item) => item.slug === "team-tally")!;

export const metadata: Metadata = pageMetadata({
  title: "Team Tally: Captained Team Night Scoring",
  description:
    "Free scoring for captained pickleball team nights. Set up the teams once, post the brief, and captains score from their phones while the standings and Flights sort themselves.",
  path: app.href,
});

/**
 * Team Tally's front door. A signed-out visitor gets what it is, shown as the
 * graphics a night actually produces, and a way in; a signed-in Organizer
 * gets their Team Events.
 */
export default async function TeamTallyPage() {
  const organizer = await getOptionalOrganizer();

  return (
    <div className="flex w-full flex-1 flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toJsonLdScript(buildAppPageJsonLd(app)) }}
      />
      {organizer ? <OrganizerList /> : <TeamTallyLanding />}
    </div>
  );
}

async function OrganizerList() {
  const supabase = await createClient();
  const events = await listTeamEvents(supabase);

  return (
    <>
      <TtHead
        title="Your Team Events"
        meta={`${events.length} ${events.length === 1 ? "night" : "nights"}`}
        actions={
          <Link href={TEAM_TALLY_NEW_EVENT_PATH} className="tt-btn">
            New Team Event
          </Link>
        }
      />

      <section className="tt-wrap pb-20 sm:pb-28">
        {events.length === 0 ? (
          <div className="tt-sheet tt-section-body grid gap-3">
            <h2 className="tt-h2">No Team Events yet</h2>
            <p className="tt-body">Build next Tuesday&apos;s night and Team Tally writes its brief.</p>
          </div>
        ) : (
          <ul className="tt-sheet tt-event-list m-0 list-none overflow-hidden p-0">
            {events.map((event) => {
              const date = eventDateParts(event.date);
              return (
                <li key={event.id}>
                  <Link href={teamEventPath(event.id)} className="tt-event-row">
                    <span className="tt-date" aria-label={eventDateLabel(event.date)}>
                      <span className="tt-date-small">{date.weekday}</span>
                      <span className="tt-date-num">{date.day}</span>
                      <span className="tt-date-small">{date.month}</span>
                    </span>
                    <span className="grid min-w-0 gap-1">
                      <span className="tt-event-name">{event.name}</span>
                      <span className="tt-meta text-[0.875rem]">
                        {event.teamCount} Teams · {event.teamCount / 2} Matchups
                      </span>
                    </span>
                    <ChevronRight aria-hidden className="text-(--tt-ink-dim)" size={22} />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <form action={signOut} className="mt-10">
          <button type="submit" className="tt-quietlink">
            Sign out
          </button>
        </form>
      </section>
    </>
  );
}
