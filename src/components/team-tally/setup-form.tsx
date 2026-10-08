"use client";

import { useActionState, useId, useState } from "react";

import { saveTeamEventAction, type SetupFormState } from "@/lib/team-tally/actions/events";
import type { SetupTeam, TeamEventSetup } from "@/lib/team-tally/setup";

const EMPTY: SetupFormState = {};

/** Seven opening Matchups is fourteen Teams: Flights A to G. */
const MAX_MATCHUPS = 7;
const MIN_MATCHUPS = 2;

type TeamDraft = SetupTeam & { key: string };
type MatchupDraft = { key: string; red: TeamDraft; blue: TeamDraft };

let draftKey = 0;
function nextKey(): string {
  draftKey += 1;
  return `draft-${draftKey}`;
}

function blankTeam(): TeamDraft {
  return { key: nextKey(), nickname: "", captain: "", slotA: "", slotB: "", slotC: "", homeCourt: "" };
}

function blankMatchup(): MatchupDraft {
  return { key: nextKey(), red: blankTeam(), blue: blankTeam() };
}

/** The saved setup as Matchup blocks, which is how the form shows it. */
function toDrafts(setup: TeamEventSetup): MatchupDraft[] {
  return setup.matchups.map(({ red, blue }) => ({
    key: nextKey(),
    red: { ...setup.teams[red], key: nextKey() },
    blue: { ...setup.teams[blue], key: nextKey() },
  }));
}

/** Back to the setup shape: Teams in Matchup order, each Matchup a pair. */
function toSetup(name: string, date: string, matchups: MatchupDraft[]): TeamEventSetup {
  const strip = (team: TeamDraft): SetupTeam => ({
    ...(team.id ? { id: team.id } : {}),
    nickname: team.nickname,
    captain: team.captain,
    slotA: team.slotA,
    slotB: team.slotB,
    slotC: team.slotC,
    homeCourt: team.homeCourt,
  });
  return {
    name,
    date,
    teams: matchups.flatMap((matchup) => [strip(matchup.red), strip(matchup.blue)]),
    matchups: matchups.map((_, index) => ({ red: index * 2, blue: index * 2 + 1 })),
  };
}

/**
 * The Organizer's setup form: the night, then each opening Matchup as its two
 * Teams. Building it Matchup by Matchup puts every Team in exactly one
 * Matchup by construction; `validateSetup` on the server checks the rest.
 *
 * Plain on the site's Broadcast Dark tokens until #627 gives Team Tally its
 * own look.
 */
export function SetupForm({
  eventId,
  initial,
  defaultDate,
}: {
  eventId?: string;
  initial?: TeamEventSetup;
  defaultDate: string;
}) {
  const [state, formAction, pending] = useActionState(saveTeamEventAction, EMPTY);
  const [name, setName] = useState(initial?.name ?? "");
  const [date, setDate] = useState(initial?.date ?? defaultDate);
  const [matchups, setMatchups] = useState<MatchupDraft[]>(() =>
    initial ? toDrafts(initial) : [blankMatchup(), blankMatchup()],
  );

  function updateTeam(matchupKey: string, side: "red" | "blue", field: keyof SetupTeam, value: string) {
    setMatchups((current) =>
      current.map((matchup) =>
        matchup.key === matchupKey ? { ...matchup, [side]: { ...matchup[side], [field]: value } } : matchup,
      ),
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <input type="hidden" name="setup" value={JSON.stringify(toSetup(name, date, matchups))} />
      {eventId && <input type="hidden" name="eventId" value={eventId} />}

      <div className="bx-panel grid gap-6 p-6 sm:grid-cols-[minmax(0,1fr)_14rem] sm:p-8">
        <div className="flex flex-col gap-2">
          <label htmlFor="tt-event-name" className="bx-label">
            Name of the night
          </label>
          <input
            id="tt-event-name"
            className="bx-field"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Tuesday Team Night"
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="tt-event-date" className="bx-label">
            Date
          </label>
          <input
            id="tt-event-date"
            type="date"
            className="bx-field"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            required
          />
        </div>
      </div>

      <ol className="flex flex-col gap-6">
        {matchups.map((matchup, index) => (
          <li key={matchup.key} className="bx-panel p-6 sm:p-8">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="bx-h2 text-lg">Match {index + 1}</h2>
              <p className="bx-meta">
                {matchup.red.homeCourt.trim() && matchup.blue.homeCourt.trim()
                  ? `Courts ${matchup.red.homeCourt.trim()} & ${matchup.blue.homeCourt.trim()}`
                  : "Courts from the two home courts"}
              </p>
            </div>
            <div className="mt-6 grid gap-8 lg:grid-cols-2">
              <TeamFields
                legend={`Match ${index + 1}, team 1`}
                team={matchup.red}
                onChange={(field, value) => updateTeam(matchup.key, "red", field, value)}
              />
              <TeamFields
                legend={`Match ${index + 1}, team 2`}
                team={matchup.blue}
                onChange={(field, value) => updateTeam(matchup.key, "blue", field, value)}
              />
            </div>
            {matchups.length > MIN_MATCHUPS && (
              <button
                type="button"
                className="bx-quietlink mt-6"
                onClick={() => setMatchups((current) => current.filter((item) => item.key !== matchup.key))}
              >
                Remove Match {index + 1}
              </button>
            )}
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-center gap-4">
        {matchups.length < MAX_MATCHUPS && (
          <button
            type="button"
            className="bx-btn bx-btn-ghost"
            onClick={() => setMatchups((current) => [...current, blankMatchup()])}
          >
            Add a Matchup
          </button>
        )}
        <p className="text-sm text-(--bx-muted)">
          {matchups.length * 2} Teams, {matchups.length} Flights. Up to 14 Teams.
        </p>
      </div>

      {state.problems && state.problems.length > 0 && (
        <div role="alert" className="bx-panel p-6">
          <p className="bx-label">Fix these before saving:</p>
          <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-[0.9375rem] text-(--bx-muted)">
            {state.problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </div>
      )}

      <button type="submit" disabled={pending} className="bx-btn bx-btn-play w-fit disabled:opacity-60">
        {pending ? "Saving…" : eventId ? "Save changes" : "Save and write the brief"}
      </button>
    </form>
  );
}

const TEAM_FIELDS: { field: keyof SetupTeam; label: string; optional?: boolean; short?: boolean }[] = [
  { field: "captain", label: "Captain" },
  { field: "slotA", label: "Player A" },
  { field: "slotB", label: "Player B" },
  { field: "slotC", label: "Player C" },
  { field: "nickname", label: "Nickname", optional: true },
  { field: "homeCourt", label: "Home court", short: true },
];

function TeamFields({
  legend,
  team,
  onChange,
}: {
  legend: string;
  team: TeamDraft;
  onChange: (field: keyof SetupTeam, value: string) => void;
}) {
  const id = useId();

  return (
    <fieldset className="flex min-w-0 flex-col gap-4">
      <legend className="bx-meta mb-4">{legend}</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        {TEAM_FIELDS.map(({ field, label, optional, short }) => (
          <div key={field} className="flex flex-col gap-2">
            <label htmlFor={`${id}-${field}`} className="bx-label">
              {label}
              {optional && <span className="font-normal text-(--bx-muted)"> (optional)</span>}
            </label>
            <input
              id={`${id}-${field}`}
              className={short ? "bx-field sm:max-w-[8rem]" : "bx-field"}
              value={team[field] ?? ""}
              onChange={(event) => onChange(field, event.target.value)}
              required={!optional}
              autoComplete="off"
            />
          </div>
        ))}
      </div>
    </fieldset>
  );
}
