"use client";

import { useMemo, useState } from "react";

import {
  clampConfig,
  isSupportedRosterSize,
  MAX_ROUNDS,
  maxCourts,
  type ResolvedConfig,
} from "@/components/apps/match-mixer/lib/engine/config";
import { parseRoster } from "@/components/apps/match-mixer/lib/engine/roster";
import { scoreSchedule } from "@/components/apps/match-mixer/lib/engine/scorer";
import { generateSchedule } from "@/components/apps/match-mixer/lib/engine/schedule";
import {
  MAX_ROSTER_SIZE,
  MIN_ROSTER_SIZE,
  type Roster,
} from "@/components/apps/match-mixer/lib/engine/types";

import { PartnerMatrix } from "./partner-matrix";
import { ScheduleGrid } from "./schedule-grid";

/**
 * Match Mixer's only screen. Paste a Roster, set your courts, read the
 * Schedule.
 *
 * Any Roster from 4 to 32 works: the three sizes with a stored Table are
 * served from it, everything else is generated and scored the same way, and
 * the screen cannot tell you which because it never claims a Schedule is
 * balanced. Only the summary line does, off the Scorer.
 *
 * Debounced rendering, the reseed action and the print sheet arrive in RR-1.3
 * onward; the Config is already the shape they need.
 */

const EXAMPLE_ROSTER = [
  "Ben Johns",
  "Anna Leigh Waters",
  "Federico Staksrud",
  "Catherine Parenteau",
  "JW Johnson",
  "Anna Bright",
  "Gabriel Tardio",
  "Jorja Johnson",
].join("\n");

/**
 * Fixed for now. RR-1.3 turns it into state so that "new schedule" can write a
 * fresh one, which is the whole of what regenerating means.
 */
const SEED = 1;

export function MatchMixer() {
  const [text, setText] = useState("");
  // The Roster is kept beside the text rather than derived from it, because
  // parsing has to see the previous entries to hand a corrected or reordered
  // line back its existing id.
  const [roster, setRoster] = useState<Roster>([]);
  // Null means "whatever this Roster suggests", so the fields keep following
  // the names being pasted until the organizer overrules them.
  const [courtsChoice, setCourtsChoice] = useState<number | null>(null);
  const [roundsChoice, setRoundsChoice] = useState<number | null>(null);

  const editRoster = (next: string) => {
    setText(next);
    setRoster((previous) => parseRoster(next, previous));
  };

  const size = roster.length;
  const supported = isSupportedRosterSize(size);
  const courtCeiling = maxCourts(size);
  // The fields show what the engine will actually use, which is the same clamp
  // `generateSchedule` applies rather than a second opinion beside it. A null
  // choice is an untouched or emptied field, and means the default.
  const config = useMemo<ResolvedConfig>(
    () =>
      clampConfig({
        roster,
        courts: courtsChoice ?? undefined,
        rounds: roundsChoice ?? undefined,
        seed: SEED,
      }),
    [roster, courtsChoice, roundsChoice],
  );
  const { courts, rounds } = config;

  const result = useMemo(() => {
    if (!supported) return null;
    const schedule = generateSchedule(config);
    return { schedule, score: scoreSchedule(schedule, config) };
  }, [config, supported]);

  return (
    <div className="mm-sheet">
      <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <header className="max-w-2xl">
          <p className="mm-legend">Pickleball Tools</p>
          <h1 className="mm-title mt-3 text-4xl sm:text-5xl">Match Mixer</h1>
          <p className="mm-lede mt-4">
            A pickleball round robin generator. Paste the names you have tonight and
            get a doubles rotation where nobody partners the same person twice.
            Nothing is saved and nothing is sent anywhere.
          </p>
        </header>

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] lg:gap-14">
          <div>
            <label className="mm-legend block" htmlFor="mm-roster">
              Roster
            </label>
            <textarea
              id="mm-roster"
              className="mm-input mt-3 h-64 w-full resize-y p-3"
              value={text}
              onChange={(event) => editRoster(event.target.value)}
              placeholder={EXAMPLE_ROSTER}
              spellCheck={false}
              aria-describedby="mm-roster-note"
            />
            <p id="mm-roster-note" className="mm-note mt-2">
              One name per line, {MIN_ROSTER_SIZE} to {MAX_ROSTER_SIZE} players.
            </p>

            {supported ? (
              <div className="mm-fields mt-8">
                <NumberField
                  id="mm-courts"
                  label="Courts"
                  value={courts}
                  min={1}
                  max={courtCeiling}
                  onChange={setCourtsChoice}
                  note={
                    courtCeiling === 1
                      ? `${size} players fill one court.`
                      : `Up to ${courtCeiling} with ${size} players.`
                  }
                />
                <NumberField
                  id="mm-rounds"
                  label="Rounds"
                  value={rounds}
                  min={1}
                  max={MAX_ROUNDS}
                  onChange={setRoundsChoice}
                  note="How many you have court time for."
                />
              </div>
            ) : null}
          </div>

          <div className="min-w-0">
            {result ? (
              <>
                <ScheduleGrid
                  roster={roster}
                  schedule={result.schedule}
                  score={result.score}
                />
                <PartnerMatrix roster={roster} score={result.score} />
              </>
            ) : (
              <RosterOutOfRange size={size} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The field shows the value the engine will actually use, so a number the
 * Roster cannot support snaps back to the ceiling the moment it is typed
 * rather than generating something the Roster cannot seat.
 *
 * An emptied field is the one thing that cannot snap back, because backspacing
 * to nothing is how you start typing a different number. It is held as a draft
 * for as long as the field has focus, means "the default" while it is empty,
 * and gives way to the real value on blur.
 */
function NumberField({
  id,
  label,
  value,
  min,
  max,
  note,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  note: string;
  onChange: (next: number | null) => void;
}) {
  const [emptied, setEmptied] = useState(false);

  return (
    <div>
      <label className="mm-legend block" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        className="mm-input mm-number mt-2"
        value={emptied ? "" : value}
        min={min}
        max={max}
        onChange={(event) => {
          const raw = event.target.value;
          const next = Number.parseInt(raw, 10);
          setEmptied(raw === "");
          if (raw === "" || !Number.isNaN(next)) onChange(raw === "" ? null : next);
        }}
        onBlur={() => setEmptied(false)}
        aria-describedby={`${id}-note`}
      />
      <p id={`${id}-note`} className="mm-note mt-2">
        {note}
      </p>
    </div>
  );
}

function RosterOutOfRange({ size }: { size: number }) {
  if (size === 0) {
    return (
      <div className="mm-placeholder">
        <p className="mm-placeholder-head">No roster yet</p>
        <p className="mm-note mt-2">
          Paste your names into the box, one per line, and the schedule appears
          here.
        </p>
      </div>
    );
  }

  const tooFew = size < MIN_ROSTER_SIZE;

  return (
    <div className="mm-placeholder">
      <p className="mm-placeholder-head">
        {size} {size === 1 ? "name" : "names"}:{" "}
        {tooFew ? "not enough to play" : "too many to schedule"}
      </p>
      <p className="mm-note mt-2">
        {tooFew
          ? `Doubles needs four players on a court. Add ${MIN_ROSTER_SIZE - size} more and the schedule appears.`
          : `Match Mixer schedules up to ${MAX_ROSTER_SIZE} players. Above that the partner matrix stops being readable on one sheet, and a night that size is better split into two rotations. Remove ${size - MAX_ROSTER_SIZE}.`}
      </p>
    </div>
  );
}
