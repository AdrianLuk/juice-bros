import type { ReactNode } from "react";
import Link from "next/link";

import { siteConfig } from "@/config/site";
import { flightMatchups } from "@/lib/team-tally/event-doc";
import { clubToday } from "@/lib/team-tally/format";
import { landingNights } from "@/lib/team-tally/demo/landing";
import { screenNamed, type DemoScreen } from "@/lib/team-tally/demo/screens";
import {
  TEAM_TALLY_DEMO_PATH,
  TEAM_TALLY_NEW_EVENT_PATH,
  TEAM_TALLY_SIGN_IN_PATH,
} from "@/lib/team-tally/routes";
import { FlightHandoff } from "../flight-handoff";
import { StandingsTower } from "../standings-tower";
import { TtAppBar } from "../tt-head";
import { HeroNight } from "./hero-night";
import { OrganizerPreview, PhonePreview, ScoreLinkPreview, TvPreview } from "./previews";

/** Sign in, then straight to building a night. */
const BUILD_A_NIGHT = `${TEAM_TALLY_SIGN_IN_PATH}?next=${encodeURIComponent(TEAM_TALLY_NEW_EVENT_PATH)}`;

const STEPS = [
  {
    when: "Before the night",
    title: "Build the night",
    text: "Type in each Team's captain, three players and home court, then pair the Teams into Matchups. If you already send a brief by hand, paste last week's and the form fills itself in.",
  },
  {
    when: "Before the night",
    title: "Post the brief",
    text: "Team Tally writes the message for the group chat in the format you already use, with the courts and rosters for every Matchup and a Score Link under each Team.",
  },
  {
    when: "During the opening round",
    title: "Captains score from their phones",
    text: "Each captain opens their Team's link and enters Games as they finish. There is no app to install and no account. The standings re-sort as each score lands.",
  },
  {
    when: "When the opening round ends",
    title: "The Flights get placed",
    text: "The last opening Matchup marked done ranks every Team and sends each Flight to its courts. Nobody adds anything up.",
  },
  {
    when: "End of the night",
    title: "Results go up",
    text: "The last Flight marked done ends the night, and the Public Link becomes the results page with the Flight champions at the top.",
  },
];

/** One more line per screen, past the demo's tagline: the detail an organizer would ask about. */
const SCREEN_DETAIL: Record<DemoScreen, string> = {
  score: "Each Team's link is printed under its roster in the brief. Whoever holds it can score that Team's Games.",
  public: "Standings re-sort as scores land, with each Flight's line drawn across them.",
  tv: "Open the Public Link on the venue screen. It cuts between the standings and the Matchups, sized to read from across the room.",
  organizer: "Any Game you change says the organizer changed it, so nobody wonders where a score came from.",
  brief: "Written the way a team-night brief already reads, emoji and all, with one button to copy it.",
};

const TIE_LADDER = [
  { rule: "Team score", how: "Every point from the six Games." },
  { rule: "Head to head", how: "If the two Teams played each other, the Matchup winner goes ahead." },
  { rule: "Point differential", how: "Points won minus points lost, across the six Games." },
  { rule: "Games won", how: "Out of six." },
  { rule: "The Organizer", how: "Level on all of that, and you pick which Team goes ahead." },
];

const ROUNDS = [
  { round: 1, captains: "Captain + Player A, against the other captain + their Player A", teammates: "B and C, against B and C" },
  { round: 2, captains: "Captain + Player B, against the other captain + their Player B", teammates: "A and C, against A and C" },
  { round: 3, captains: "Captain + Player C, against the other captain + their Player C", teammates: "A and B, against A and B" },
];

const FAQ = [
  {
    question: "Do players need an account?",
    answer:
      "No. Players are names on a roster. Captains score through the Score Link printed under their Team in the brief, which needs no account. Only the Organizer signs in.",
  },
  {
    question: "What does it cost?",
    answer: "Nothing. Team Tally is free to use and has no ads.",
  },
  {
    question: "How many Teams can a night have?",
    answer:
      "An even number from 4 to 14, four players to a Team. Every two Teams make one opening Matchup on a pair of courts, so 14 Teams play seven Matchups and then seven Flights.",
  },
  {
    question: "What happens on a tie?",
    answer:
      "A Matchup tied on Team score plays a Dreambreaker, and a captain records who won it before marking the Matchup done. Its points don't count toward either Team score. In the standings, equal Team scores are split by head to head, then point differential, then Games won, and the tower says which one decided it.",
  },
  {
    question: "Can I change things once play has started?",
    answer:
      "Setup locks once a Game has a score, so the Teams and Matchups stay as the brief printed them. Captains can still rename or reorder their own players for any Round with no score yet, and you can still fix any score or reopen a Matchup that was marked done.",
  },
];

/**
 * Team Tally's signed-out landing (issue #636): Persuade mode inside the
 * broadcast package world. It sells the whole night to an organizer who runs
 * one off a whiteboard and a spreadsheet, and every preview on it is a real
 * component on a made-up night (`demo/landing.ts`), never a screenshot.
 */
export function TeamTallyLanding() {
  const date = clubToday();
  const nights = landingNights(date, siteConfig.url);
  const teams = new Map(nights.flights.teams.map((team) => [team.id, team]));
  const flightA = flightMatchups(nights.flights).find((flight) => flight.flightLetter === "A")!;

  return (
    <>
      <TtAppBar context="Free for organizers" />

      <section className="tt-wrap grid gap-10 pt-8 pb-14 sm:pt-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:items-center lg:gap-14 lg:pb-20">
        <div className="grid gap-6">
          <h1 className="tt-title">Scoring for captained team nights</h1>
          <p className="tt-meta m-0">Free · Account for organizers only</p>
          <p className="tt-lead">
            For the team night that runs off a whiteboard and a spreadsheet. Set up the Teams once and Team Tally
            writes the brief for the group chat. From there the captains keep score on their phones, and the
            standings and Flights take care of themselves.
          </p>
          <div className="tt-actions">
            <Link href={TEAM_TALLY_SIGN_IN_PATH} className="tt-btn">
              Sign in to build a night
            </Link>
            <Link href={TEAM_TALLY_DEMO_PATH} className="tt-btn tt-btn-ghost">
              Try a demo night
            </Link>
          </div>
        </div>
        <HeroNight />
      </section>

      <section className="tt-land-band" aria-labelledby="tt-land-run">
        <div className="tt-wrap tt-land-section">
          <div className="tt-land-head">
            <h2 id="tt-land-run" className="tt-land-h2">
              How a night runs
            </h2>
            <p className="tt-lead">From the brief in the group chat to the results page, in the order it happens.</p>
          </div>
          <ol className="tt-land-steps">
            {STEPS.map((step, index) => (
              <li key={step.title} className="tt-land-step">
                <span aria-hidden className="tt-land-step-num">
                  {index + 1}
                </span>
                <h3 className="tt-land-h3">{step.title}</h3>
                <p className="tt-land-when">{step.when}</p>
                <p className="tt-body">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="tt-land-band" aria-labelledby="tt-land-screens">
        <div className="tt-wrap tt-land-section">
          <div className="tt-land-head">
            <h2 id="tt-land-screens" className="tt-land-h2">
              One night, five screens
            </h2>
            <p className="tt-lead">
              Every screen shows the same night as it happens. Which one you look at depends on where you are standing.
            </p>
          </div>
          <div className="tt-land-screens">
            <Screen id="score">
              <ScoreLinkPreview event={nights.night} myTeamId={nights.myTeamId} />
              <p className="tt-land-hint">
                Enter the teammates&apos; game and save. A score like{" "}
                <span className="whitespace-nowrap">13-9</span> gets turned back with what it should have been.
              </p>
            </Screen>
            <Screen id="public">
              <StandingsTower event={nights.night} />
            </Screen>
            <Screen id="tv">
              <div className="tt-land-tv">
                <TvPreview event={nights.night} />
              </div>
              <p className="tt-land-hint tt-land-tv-hint">Swipe across the screen to see all of it.</p>
            </Screen>
            <Screen id="organizer">
              <OrganizerPreview
                matchup={nights.organizerMatchup}
                game={nights.organizerGame}
                teams={nights.night.teams}
              />
            </Screen>
            <Screen id="brief">
              <pre aria-label="An excerpt of the brief" className="tt-sheet tt-brief tt-land-brief">
                {nights.briefExcerpt}
              </pre>
            </Screen>
          </div>
        </div>
      </section>

      <section className="tt-land-band" aria-labelledby="tt-land-flights">
        <div className="tt-wrap tt-land-section tt-land-split">
          <div className="grid content-start gap-6">
            <div className="tt-land-head tt-land-head-flush">
              <h2 id="tt-land-flights" className="tt-land-h2">
                Flights place themselves
              </h2>
              <p className="tt-lead">
                When the last opening Matchup is marked done, Team Tally ranks every Team on its Team score and pairs
                them off. The top two play for Flight A, the next two for Flight B, and on down, each Flight on one of
                the night&apos;s court pairs.
              </p>
            </div>
            <div className="grid gap-3">
              <h3 className="tt-land-h3">How Seeding orders the Teams</h3>
              <ol className="tt-land-ladder">
                {TIE_LADDER.map((rung) => (
                  <li key={rung.rule}>
                    <b>{rung.rule}</b>
                    <span>{rung.how}</span>
                  </li>
                ))}
              </ol>
              <p className="tt-body">
                Each rule only matters when the ones above it are level. The tower names the rule that decided a
                placing, under the Team that came out ahead.
              </p>
            </div>
          </div>
          <div className="tt-land-stack">
            <FlightHandoff flight={flightA} teams={teams} />
            <StandingsTower event={nights.flights} positions={[1, 6]} label="Opening standings" roundKey={false} />
          </div>
        </div>
      </section>

      <section className="tt-land-band" aria-labelledby="tt-land-runs">
        <div className="tt-wrap tt-land-section">
          <div className="tt-land-head">
            <h2 id="tt-land-runs" className="tt-land-h2">
              It runs without you
            </h2>
            <p className="tt-lead">
              You can play in your own Matchup. The captains keep the night moving, and anything that can&apos;t be
              right gets turned back before it reaches the standings.
            </p>
          </div>
          <ul className="tt-sheet tt-land-rules">
            <Rule title="Captains set their own lineups" proof={<p className="tt-flag-note m-0">{nights.refusals.roster}</p>}>
              Either captain can rename or reorder their Team&apos;s players on the night, for any Round with no score
              yet. A sub takes the slot of the player they replace.
            </Rule>
            <Rule title="Impossible scores don't save" proof={<p className="tt-flag-note m-0">{nights.refusals.score}</p>}>
              A Game is first to 11, win by 2, so a typo a game can&apos;t end on is refused with the score it should
              have been. Time-capped scores like 9-8 still save.
            </Rule>
            <Rule title="A tie needs its Dreambreaker" proof={<p className="tt-flag-note m-0">{nights.refusals.tie}</p>}>
              A Matchup level on Team score can&apos;t be marked done until a captain records who won the Dreambreaker.
            </Rule>
            <Rule
              title="You can still fix anything"
              proof={
                <p className="tt-land-edit">
                  <span className="tt-meta text-[0.8125rem]">A Game you changed</span>
                  <span className="tt-lower-third">Edited by the organizer</span>
                </p>
              }
            >
              Signed in as the Organizer, you can change any score or reopen a Matchup that was marked done. When two
              Teams are level on every count, you decide which goes ahead.
            </Rule>
          </ul>
        </div>
      </section>

      <section className="tt-land-band" aria-labelledby="tt-land-notv">
        <div className="tt-wrap tt-land-section tt-land-split tt-land-split-phone">
          <div className="tt-land-head tt-land-head-flush">
            <h2 id="tt-land-notv" className="tt-land-h2">
              No TV? Fine.
            </h2>
            <p className="tt-lead">
              The Public Link is one link for everyone, and it works on any phone or laptop. On a phone it scrolls:
              the standings, then every Matchup with its Games and who entered them.
            </p>
            <p className="tt-body">
              It&apos;s at the top of the brief, so everyone at the night has it already. On a screen 1280 pixels
              wide or more it turns into the big-screen view, if you do find a TV.
            </p>
          </div>
          <PhonePreview event={nights.night} />
        </div>
      </section>

      <section className="tt-land-band" aria-labelledby="tt-land-format">
        <div className="tt-wrap tt-land-section">
          <div className="tt-sheet">
            <div className="tt-section-head">
              <h2 id="tt-land-format" className="tt-h2">
                The format it runs
              </h2>
              <span className="tt-meta">4 to 14 Teams · 3 Rounds · 6 Games</span>
            </div>
            <div className="tt-section-body grid gap-8 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
              <div className="grid content-start gap-4">
                <p className="tt-body">
                  Teams of four, a captain and players A, B and C. Each Matchup puts two Teams on a pair of courts for
                  three Rounds. The captain partners A, then B, then C against the other captain, while the other two
                  on each side play their own game.
                </p>
                <p className="tt-body">
                  Team score is every point across the six Games. The top two Teams play for Flight A, the next two
                  for Flight B, and on down.
                </p>
              </div>
              <ol className="m-0 grid list-none gap-0 p-0 sm:hidden">
                {ROUNDS.map((row) => (
                  <li
                    key={row.round}
                    className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-3 gap-y-1 border-t border-(--tt-rule) py-3"
                  >
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
        </div>
      </section>

      <section className="tt-wrap tt-land-section tt-land-section-follow tt-land-faq-grid" aria-labelledby="tt-land-faq">
        <h2 id="tt-land-faq" className="tt-land-h2">
          Questions
        </h2>
        <div className="tt-sheet tt-land-faq">
          {FAQ.map((item) => (
            <details key={item.question} className="tt-land-q">
              <summary>{item.question}</summary>
              <p className="tt-body">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="tt-land-band" aria-labelledby="tt-land-close">
        <div className="tt-wrap tt-land-section tt-land-close">
          <h2 id="tt-land-close" className="tt-land-h2">
            Try a night before you run one
          </h2>
          <p className="tt-lead">
            The demo is a fourteen-Team night partway through its opening round. Enter a score on Golden Set&apos;s
            Score Link, then let it run to the results. Nothing is saved.
          </p>
          <div className="tt-actions">
            <Link href={TEAM_TALLY_DEMO_PATH} className="tt-btn">
              Try the demo
            </Link>
            <Link href={BUILD_A_NIGHT} className="tt-btn tt-btn-ghost">
              Build a night
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

/** One of the five screens: its name, who holds it, what it is for, then the real thing. */
function Screen({ id, children }: { id: DemoScreen; children: ReactNode }) {
  const screen = screenNamed(id);
  return (
    <article className="tt-land-slot" data-screen={id} aria-labelledby={`tt-land-screen-${id}`}>
      <header className="tt-land-slot-head">
        <h3 id={`tt-land-screen-${id}`} className="tt-land-h3">
          {screen.label}
        </h3>
        <p className="tt-land-when">{screen.who}</p>
        <p className="tt-body">
          {screen.what} {SCREEN_DETAIL[id]}
        </p>
      </header>
      <div className="tt-land-preview">{children}</div>
    </article>
  );
}

/** A rule the night keeps by itself, beside what the screen says when it does. */
function Rule({ title, proof, children }: { title: string; proof: ReactNode; children: ReactNode }) {
  return (
    <li className="tt-land-rule">
      <div className="grid gap-2">
        <h3 className="tt-land-h3">{title}</h3>
        <p className="tt-body">{children}</p>
      </div>
      <div className="tt-callout tt-land-proof">{proof}</div>
    </li>
  );
}
