import type { Metadata } from "next";
import Link from "next/link";

import { apps } from "@/data/apps";
import { PageHead } from "@/components/bx/page-head";
import { pageMetadata } from "@/lib/metadata";
import { buildAppPageJsonLd, toJsonLdScript } from "@/lib/structured-data";
import { signOut } from "@/lib/team-tally/actions/auth";
import { getOptionalOrganizer } from "@/lib/team-tally/dal";
import { listTeamEvents } from "@/lib/team-tally/events";
import { eventDateLabel } from "@/lib/team-tally/format";
import {
  TEAM_TALLY_NEW_EVENT_PATH,
  TEAM_TALLY_SIGN_IN_PATH,
  teamEventPath,
} from "@/lib/team-tally/routes";
import { createClient } from "@/lib/team-tally/supabase/server";

const app = apps.find((item) => item.slug === "team-tally")!;

export const metadata: Metadata = pageMetadata({
  title: "Team Tally: Captained Team Night Scoring",
  description:
    "Free scoring for captained pickleball team nights. Set up the teams and Matchups once and get the brief for your group chat.",
  path: app.href,
});

/**
 * Team Tally's front door. A signed-out visitor gets what it is and a way in;
 * a signed-in Organizer gets their Team Events.
 *
 * Plain on the site's Broadcast Dark tokens: #627 gives Team Tally its own
 * look and restyles this.
 */
export default async function TeamTallyPage() {
  const organizer = await getOptionalOrganizer();

  return (
    <div className="flex w-full flex-1 flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toJsonLdScript(buildAppPageJsonLd(app)) }}
      />
      {organizer ? <OrganizerList /> : <Landing />}
    </div>
  );
}

function Landing() {
  return (
    <>
      <PageHead
        title="Scoring for captained team nights"
        meta="Team Tally · Free · Account for organizers only"
        lead="Set up the night's teams and Matchups once. Team Tally writes the brief you post in the group chat, with every roster and every court pair in it."
        actions={
          <Link href={TEAM_TALLY_SIGN_IN_PATH} className="bx-btn bx-btn-play">
            Sign in to build a night
          </Link>
        }
      />

      <section className="bx-measure pb-20 sm:pb-28">
        <div className="bx-panel p-6 sm:p-8">
          <h2 className="bx-h2 text-lg sm:text-xl">The format it runs</h2>
          <p className="mt-4 max-w-[60ch] text-[1.0625rem] leading-relaxed text-(--bx-muted)">
            Teams of four, a captain and players A, B and C, with 4 to 14 Teams a night. Each Matchup
            puts two Teams on a pair of courts for three Rounds. The captain partners A, then B, then C
            against the other captain, while the other two on each side play their own game.
          </p>
          <p className="mt-4 max-w-[60ch] text-[1.0625rem] leading-relaxed text-(--bx-muted)">
            Team score is every point across the six Games. The top two Teams play for Flight A, the
            next two for Flight B, and on down.
          </p>
        </div>
      </section>
    </>
  );
}

async function OrganizerList() {
  const supabase = await createClient();
  const events = await listTeamEvents(supabase);

  return (
    <>
      <PageHead
        title="Your Team Events"
        meta={`${events.length} ${events.length === 1 ? "night" : "nights"}`}
        actions={
          <Link href={TEAM_TALLY_NEW_EVENT_PATH} className="bx-btn bx-btn-play">
            New Team Event
          </Link>
        }
      />

      <section className="bx-measure pb-20 sm:pb-28">
        {events.length === 0 ? (
          <div className="bx-panel p-6 sm:p-8">
            <h2 className="bx-h2 text-lg">No Team Events yet</h2>
            <p className="mt-3 max-w-[52ch] text-[0.9375rem] leading-relaxed text-(--bx-muted)">
              Build next Tuesday&apos;s night and Team Tally writes its brief.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {events.map((event) => (
              <li key={event.id}>
                <Link
                  href={teamEventPath(event.id)}
                  className="bx-panel group flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 p-5 sm:p-6"
                >
                  <span className="bx-h2 text-base sm:text-lg">{event.name}</span>
                  <span className="bx-meta">
                    {eventDateLabel(event.date)} · {event.teamCount} Teams
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <form action={signOut} className="mt-10">
          <button type="submit" className="bx-quietlink">
            Sign out
          </button>
        </form>
      </section>
    </>
  );
}
