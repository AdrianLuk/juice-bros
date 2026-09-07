"use client";

import { useMemo, useState } from "react";

import { parseRoster } from "@/components/apps/match-mixer/lib/engine/roster";
import { scoreSchedule } from "@/components/apps/match-mixer/lib/engine/scorer";
import { generateSchedule } from "@/components/apps/match-mixer/lib/engine/schedule";
import {
  SUPPORTED_ROSTER_SIZES,
  type Config,
} from "@/components/apps/match-mixer/lib/engine/types";
import { PartnerMatrix } from "@/components/apps/match-mixer/partner-matrix";
import { ScheduleGrid } from "@/components/apps/match-mixer/schedule-grid";

/**
 * Match Mixer's only screen. Paste a Roster, read the Schedule.
 *
 * This milestone serves the three Roster sizes with a stored Table (8, 12, 16
 * at n/4 courts) and says so plainly for anything else. Courts, Round count,
 * the greedy generator, debounced rendering and the print sheet arrive in
 * RR-1.2 onward; the Config is already the shape they need.
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

function listSizes(sizes: readonly number[]): string {
  if (sizes.length < 2) return String(sizes[0] ?? "");
  return `${sizes.slice(0, -1).join(", ")} or ${sizes[sizes.length - 1]}`;
}

export function MatchMixer() {
  const [text, setText] = useState("");

  const roster = useMemo(() => parseRoster(text), [text]);
  const size = roster.length;
  const supported = SUPPORTED_ROSTER_SIZES.includes(size);

  const result = useMemo(() => {
    if (!supported) return null;
    const config: Config = { roster, courts: size / 4, seed: 1 };
    const schedule = generateSchedule(config);
    return { config, schedule, score: scoreSchedule(schedule, config) };
  }, [roster, size, supported]);

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
              onChange={(event) => setText(event.target.value)}
              placeholder={EXAMPLE_ROSTER}
              spellCheck={false}
              aria-describedby="mm-roster-note"
            />
            <p id="mm-roster-note" className="mm-note mt-2">
              One name per line. {listSizes(SUPPORTED_ROSTER_SIZES)} players for now.
            </p>
            <button
              type="button"
              className="mm-button mt-3"
              onClick={() => setText(EXAMPLE_ROSTER)}
            >
              Use an example roster
            </button>
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
              <UnsupportedRoster size={size} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function UnsupportedRoster({ size }: { size: number }) {
  const sizes = listSizes(SUPPORTED_ROSTER_SIZES);

  return (
    <div className="mm-placeholder">
      {size === 0 ? (
        <>
          <p className="mm-placeholder-head">No roster yet</p>
          <p className="mm-note mt-2">
            Paste {sizes} names into the box and the schedule appears here.
          </p>
        </>
      ) : (
        <>
          <p className="mm-placeholder-head">
            {size} {size === 1 ? "name" : "names"}: not yet supported
          </p>
          <p className="mm-note mt-2">
            Match Mixer handles {sizes} players so far. Those are the sizes with
            a published schedule where every player partners every other exactly
            once and nobody sits out. Other roster sizes are on the way.
          </p>
        </>
      )}
    </div>
  );
}
