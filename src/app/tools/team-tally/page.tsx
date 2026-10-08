import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { apps } from "@/data/apps";
import { ScoreBug } from "@/components/team-tally/score-bug";
import { TimingTower } from "@/components/team-tally/timing-tower";
import { TtAppBar, TtHead } from "@/components/team-tally/tt-head";
import { pageMetadata } from "@/lib/metadata";
import { buildAppPageJsonLd, toJsonLdScript } from "@/lib/structured-data";
import { signOut } from "@/lib/team-tally/actions/auth";
import { getOptionalOrganizer } from "@/lib/team-tally/dal";
import { listTeamEvents } from "@/lib/team-tally/events";
import { eventDateLabel, eventDateParts } from "@/lib/team-tally/format";
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
      {organizer ? <OrganizerList /> : <Landing />}
    </div>
  );
}

const ROUNDS = [
  { round: 1, captains: "Captain + Player A, against the other captain + their Player A", teammates: "B and C, against B and C" },
  { round: 2, captains: "Captain + Player B, against the other captain + their Player B", teammates: "A and C, against A and C" },
  { round: 3, captains: "Captain + Player C, against the other captain + their Player C", teammates: "A and B, against A and B" },
];

function Landing() {
  return (
    <>
      <TtAppBar context="Free for organizers" />
      <section className="tt-wrap grid gap-10 pt-8 pb-14 sm:pt-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:items-center lg:gap-14 lg:pb-20">
        <div className="grid gap-6">
          <h1 className="tt-title">Scoring for captained team nights</h1>
          <p className="tt-meta m-0">Free · Account for organizers only</p>
          <p className="tt-lead">
            Set up the night&apos;s teams and Matchups once. Team Tally writes the brief you post in the group
            chat, with every roster and every court pair in it. Captains score from their phones, the
            standings sort themselves, and the night splits into Flights on its own.
          </p>
          <div className="tt-actions">
            <Link href={TEAM_TALLY_SIGN_IN_PATH} className="tt-btn">
              Sign in to build a night
            </Link>
          </div>
        </div>

        <figure className="m-0 grid gap-3" aria-label="An example night, mid Round 2">
          <ScoreBug
            label="Match 1 · Courts 21 & 18"
            liveRound={2}
            red={{ name: "Kitchen Sync", rounds: [22, 9, null], total: 31 }}
            blue={{ name: "Dink Floyd", rounds: [17, 7, null], total: 24 }}
          />
          <TimingTower
            label="Standings · opening round"
            liveRound={2}
            rows={[
              { position: 1, name: "Kitchen Sync", side: "red", rounds: [22, 9, null], points: 31, move: 2 },
              { position: 2, name: "Net Gains", side: "red", rounds: [21, 9, null], points: 30 },
              { position: 3, name: "Third Shot Drop", side: "red", rounds: [20, 9, null], points: 29, move: -1 },
              { position: 4, name: "Lob City", side: "blue", rounds: [19, 8, null], points: 27, move: -1 },
            ]}
          />
          <figcaption className="tt-meta text-[0.8125rem]">Example night · made-up teams</figcaption>
        </figure>
      </section>

      <section className="tt-wrap pb-20 sm:pb-28">
        <div className="tt-sheet">
          <div className="tt-section-head">
            <h2 className="tt-h2">The format it runs</h2>
            <span className="tt-meta">4 to 14 Teams · 3 Rounds · 6 Games</span>
          </div>
          <div className="tt-section-body grid gap-8 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
            <div className="grid content-start gap-4">
              <p className="tt-body">
                Teams of four, a captain and players A, B and C. Each Matchup puts two Teams on a pair of
                courts for three Rounds. The captain partners A, then B, then C against the other captain,
                while the other two on each side play their own game.
              </p>
              <p className="tt-body">
                Team score is every point across the six Games. The top two Teams play for Flight A, the
                next two for Flight B, and on down.
              </p>
            </div>
            <ol className="m-0 grid list-none gap-0 p-0 sm:hidden">
              {ROUNDS.map((row) => (
                <li key={row.round} className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-3 gap-y-1 border-t border-(--tt-rule) py-3">
                  <span className="row-span-2 font-[family-name:var(--tt-cond)] text-2xl leading-none font-extrabold">
                    R{row.round}
                  </span>
                  <p className="m-0 text-[0.9375rem]">
                    <span className="tt-meta text-[0.8125rem]">Captains&apos; game </span>
                    {row.captains}
                  </p>
                  <p className="m-0 text-[0.9375rem] text-(--tt-ink-dim)">
                    <span className="tt-meta text-[0.8125rem]">Teammates&apos; game </span>
                    {row.teammates}
                  </p>
                </li>
              ))}
            </ol>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full border-collapse text-left text-[0.9375rem]">
                <thead>
                  <tr className="tt-meta text-[0.8125rem]">
                    <th className="py-2 pr-4 font-[inherit]">Round</th>
                    <th className="py-2 pr-4 font-[inherit]">Captains&apos; game</th>
                    <th className="py-2 font-[inherit]">Teammates&apos; game</th>
                  </tr>
                </thead>
                <tbody>
                  {ROUNDS.map((row) => (
                    <tr key={row.round} className="border-t border-(--tt-rule) align-top">
                      <td className="py-3 pr-4 font-[family-name:var(--tt-cond)] text-2xl leading-none font-extrabold">
                        R{row.round}
                      </td>
                      <td className="py-3 pr-4">{row.captains}</td>
                      <td className="py-3 text-(--tt-ink-dim)">{row.teammates}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
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
