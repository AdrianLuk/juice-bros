"use client";

import { useActionState, useId, useState } from "react";

import { saveTeamEventAction, type SetupFormState } from "@/lib/team-tally/actions/events";
import { parseBrief, type ParsedBrief, type ParsedTeam, type TeamField } from "@/lib/team-tally/parse-brief";
import type { SetupTeam, TeamEventSetup } from "@/lib/team-tally/setup";

const EMPTY: SetupFormState = {};

/** Seven opening Matchups is fourteen Teams: Flights A to G. */
const MAX_MATCHUPS = 7;
const MIN_MATCHUPS = 2;

/** `flagged` is the fields a pasted brief left unreadable, until the Organizer edits them. */
type TeamDraft = SetupTeam & { key: string; flagged?: TeamField[] };
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

function draftFromParsed(team: ParsedTeam): TeamDraft {
  const { flagged, ...fields } = team;
  return { key: nextKey(), ...fields, flagged };
}

/** A pasted brief as Matchup blocks: at most the form's maximum, at least its minimum. */
function draftsFromBrief(brief: ParsedBrief): MatchupDraft[] {
  const drafts = brief.matchups.slice(0, MAX_MATCHUPS).map(({ red, blue }) => ({
    key: nextKey(),
    red: draftFromParsed(red),
    blue: draftFromParsed(blue),
  }));
  while (drafts.length < MIN_MATCHUPS) drafts.push(blankMatchup());
  return drafts;
}

function hasEnteredTeams(matchups: MatchupDraft[]): boolean {
  return matchups.some(({ red, blue }) =>
    [red, blue].some((team) =>
      [team.captain, team.slotA, team.slotB, team.slotC, team.nickname, team.homeCourt].some(
        (value) => value.trim() !== "",
      ),
    ),
  );
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
 * Each Matchup is one sheet with its two Teams side by side, red then blue,
 * the way the brief lists them.
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

  const pasteId = useId();
  const [pasted, setPasted] = useState("");
  const [pasteNotice, setPasteNotice] = useState("");
  // A pasted brief read while the form already has Teams in it: held here
  // until the Organizer confirms the replacement.
  const [awaiting, setAwaiting] = useState<ParsedBrief | null>(null);

  function updateTeam(matchupKey: string, side: "red" | "blue", field: keyof SetupTeam, value: string) {
    setMatchups((current) =>
      current.map((matchup) => {
        if (matchup.key !== matchupKey) return matchup;
        const team = matchup[side];
        // Editing a highlighted field means the Organizer has looked at it.
        const flagged = team.flagged?.filter((flag) => flag !== field);
        return { ...matchup, [side]: { ...team, [field]: value, flagged } };
      }),
    );
  }

  function applyBrief(brief: ParsedBrief) {
    const drafts = draftsFromBrief(brief);
    const unreadable = drafts.reduce(
      (total, { red, blue }) => total + (red.flagged?.length ?? 0) + (blue.flagged?.length ?? 0),
      0,
    );
    setMatchups(drafts);
    setAwaiting(null);
    setPasted("");
    const cut = brief.matchups.length - Math.min(brief.matchups.length, MAX_MATCHUPS);
    setPasteNotice(
      [
        `Filled in ${brief.matchups.length - cut} Matches from the brief.`,
        cut > 0 ? `Team Tally runs up to ${MAX_MATCHUPS} Matches, so the last ${cut} were left out.` : "",
        unreadable > 0
          ? `${unreadable} ${unreadable === 1 ? "field" : "fields"} could not be read and ${unreadable === 1 ? "is" : "are"} highlighted. Check ${unreadable === 1 ? "it" : "them"}, then save.`
          : "Check the Teams, then save.",
      ]
        .filter(Boolean)
        .join(" "),
    );
  }

  function readPasted() {
    const brief = parseBrief(pasted);
    if (brief.matchups.length === 0) {
      setAwaiting(null);
      setPasteNotice("No Matches found in that text. Paste the whole brief, starting at the MATCH 1 line.");
      return;
    }
    if (hasEnteredTeams(matchups)) {
      setPasteNotice("");
      setAwaiting(brief);
    } else {
      applyBrief(brief);
    }
  }

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <input type="hidden" name="setup" value={JSON.stringify(toSetup(name, date, matchups))} />
      {eventId && <input type="hidden" name="eventId" value={eventId} />}

      <div className="tt-sheet tt-section-body flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor={`${pasteId}-paste`} className="tt-label">
            Paste an old brief
            <span className="font-normal text-(--tt-ink-dim)"> (optional)</span>
          </label>
          <p className="text-sm text-(--tt-ink-dim)">
            Copy the brief you sent before and paste it here. The Teams, nicknames, home courts and
            court pairs fill the form below.
          </p>
          <textarea
            id={`${pasteId}-paste`}
            className="tt-field min-h-32 text-sm"
            value={pasted}
            onChange={(event) => setPasted(event.target.value)}
            spellCheck={false}
          />
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            className="tt-btn tt-btn-ghost"
            disabled={pasted.trim() === ""}
            onClick={readPasted}
          >
            Fill the form from this brief
          </button>
        </div>
        {awaiting && (
          <div role="alertdialog" aria-label="Replace the Teams in the form" className="flex flex-col gap-4 rounded-lg border-[1.5px] border-(--tt-ink) p-4">
            <p className="text-[0.9375rem]">
              The form already has Teams in it. Replace them with the {awaiting.matchups.length} Matches
              from the pasted brief?
              {eventId && " Teams you replace get new Score Links, so the Score Links in the brief you already sent stop working."}
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <button type="button" className="tt-btn" onClick={() => applyBrief(awaiting)}>
                Replace the form
              </button>
              <button type="button" className="tt-quietlink" onClick={() => setAwaiting(null)}>
                Keep what is there
              </button>
            </div>
          </div>
        )}
        <p role="status" className="text-sm text-(--tt-ink-dim)">
          {pasteNotice}
        </p>
      </div>

      <div className="tt-sheet tt-section-body grid gap-6 sm:grid-cols-[minmax(0,1fr)_14rem]">
        <div className="flex flex-col gap-2">
          <label htmlFor="tt-event-name" className="tt-label">
            Name of the night
          </label>
          <input
            id="tt-event-name"
            className="tt-field"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Tuesday Team Night"
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="tt-event-date" className="tt-label">
            Date
          </label>
          <input
            id="tt-event-date"
            type="date"
            className="tt-field"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            required
          />
        </div>
      </div>

      <ol className="flex flex-col gap-6">
        {matchups.map((matchup, index) => (
          <li key={matchup.key} className="tt-sheet">
            <div className="tt-section-head">
              <h2 className="tt-h2">Match {index + 1}</h2>
              <p className="tt-meta m-0">
                {matchup.red.homeCourt.trim() && matchup.blue.homeCourt.trim()
                  ? `Courts ${matchup.red.homeCourt.trim()} & ${matchup.blue.homeCourt.trim()}`
                  : "Courts from the two home courts"}
              </p>
            </div>
            <div className="tt-section-body grid gap-8 lg:grid-cols-2">
              <TeamFields
                legend={`Match ${index + 1}, team 1`}
                side="red"
                team={matchup.red}
                onChange={(field, value) => updateTeam(matchup.key, "red", field, value)}
              />
              <TeamFields
                legend={`Match ${index + 1}, team 2`}
                side="blue"
                team={matchup.blue}
                onChange={(field, value) => updateTeam(matchup.key, "blue", field, value)}
              />
            </div>
            {matchups.length > MIN_MATCHUPS && (
              <button
                type="button"
                className="tt-quietlink mx-5 mb-5 sm:mx-7 sm:mb-6"
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
            className="tt-btn tt-btn-ghost"
            onClick={() => setMatchups((current) => [...current, blankMatchup()])}
          >
            Add a Matchup
          </button>
        )}
        <p className="text-sm text-(--tt-ink-dim)">
          {matchups.length * 2} Teams, {matchups.length} Flights. Up to 14 Teams.
        </p>
      </div>

      {state.problems && state.problems.length > 0 && (
        <div role="alert" className="tt-sheet tt-section-body border-(--tt-flag)">
          <p className="tt-label">Fix these before saving:</p>
          <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-[0.9375rem] text-(--tt-ink-dim)">
            {state.problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </div>
      )}

      <button type="submit" disabled={pending} className="tt-btn w-fit">
        {pending ? "Saving…" : eventId ? "Save changes" : "Save and write the brief"}
      </button>
    </form>
  );
}

/** `wide` fields take the whole row on a phone, where two-up would cut a full name short. */
const TEAM_FIELDS: { field: keyof SetupTeam; label: string; optional?: boolean; short?: boolean; wide?: boolean }[] = [
  { field: "captain", label: "Captain", wide: true },
  { field: "slotA", label: "Player A", wide: true },
  { field: "slotB", label: "Player B", wide: true },
  { field: "slotC", label: "Player C", wide: true },
  { field: "nickname", label: "Nickname", optional: true },
  { field: "homeCourt", label: "Home court", short: true },
];

function TeamFields({
  legend,
  side,
  team,
  onChange,
}: {
  legend: string;
  side: "red" | "blue";
  team: TeamDraft;
  onChange: (field: keyof SetupTeam, value: string) => void;
}) {
  const id = useId();

  return (
    <fieldset className="flex min-w-0 flex-col gap-4">
      <legend className="tt-legend mb-4">
        <span aria-hidden className={`tt-side ${side === "red" ? "tt-side-red" : "tt-side-blue"}`} />
        {legend}
      </legend>
      <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:gap-x-4">
        {TEAM_FIELDS.map(({ field, label, optional, short, wide }) => {
          const flagged = team.flagged?.includes(field as TeamField) ?? false;
          return (
            <div key={field} className={`flex min-w-0 flex-col gap-2 ${wide ? "col-span-2 sm:col-span-1" : ""}`}>
              <label htmlFor={`${id}-${field}`} className="tt-label">
                {label}
                {optional && <span className="font-normal text-(--tt-ink-dim)"> (optional)</span>}
                {flagged && <span className="tt-flag-note"> (check this)</span>}
              </label>
              <input
                id={`${id}-${field}`}
                className={short ? "tt-field max-w-[8rem]" : "tt-field"}
                value={team[field] ?? ""}
                onChange={(event) => onChange(field, event.target.value)}
                required={!optional}
                aria-invalid={flagged || undefined}
                data-flagged={flagged || undefined}
                autoComplete="off"
              />
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
