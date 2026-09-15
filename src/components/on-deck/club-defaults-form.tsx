"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { saveClubDefaults } from "@/lib/on-deck/actions/sessions";
import { ON_DECK_HOME_PATH } from "@/lib/on-deck/routes";
import {
  FLOOR_MODES,
  FLOOR_MODE_LABEL,
  type ClubDefaults,
  type FloorMode,
} from "@/lib/on-deck/session/types";
import { Stage, StageHeading } from "@/components/on-deck/back-office";

type Props = ClubDefaults;

/** What each Floor Mode means for the night, in one line. */
const FLOOR_MODE_BLURB: Record<FloorMode, string> = {
  "volunteer-run":
    "Volunteer links only. Players never touch the running of the night.",
  "self-serve":
    "A kiosk by the courts, and no volunteer needed to run anything.",
  hybrid:
    "Both. Volunteers drive the night and anyone courtside can still tap a game done.",
};

/**
 * The Club itself (issue #254, user story 44; issue #515, user story 14) —
 * name, venue, court count, group cap, floor mode. Every one-tap Start reads
 * the defaults from here, and an unedited scheduled Session inherits them.
 *
 * The name and the floor mode arrived with self-serve creation. A Club used to
 * be a SQL insert somebody ran deliberately, so neither could be wrong by
 * accident; now the name is typed into a two-field form by somebody who has not
 * run a night yet, and the floor mode is nobody's choice at all until it is
 * made here.
 *
 * The Club's clock is deliberately not one of these fields — see
 * `ClubClockCard`. A form somebody opened to change a court count must not
 * commit a time zone they never chose.
 */
export function ClubDefaultsForm({
  name,
  venueName,
  courtCount,
  groupCap,
  floorMode,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [clubName, setClubName] = useState(name);
  const [venue, setVenue] = useState(venueName);
  const [courts, setCourts] = useState(String(courtCount));
  const [cap, setCap] = useState(String(groupCap));
  const [mode, setMode] = useState<FloorMode>(floorMode);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveClubDefaults({
        name: clubName,
        venueName: venue,
        courtCount: Number(courts),
        groupCap: Number(cap),
        floorMode: mode,
      });
      if (!result.ok) {
        setError(result.error ?? "Couldn't save. Try again.");
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <Stage tone="flat">
      <StageHeading>The club</StageHeading>

      <form onSubmit={submit} className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <label className="od-readout text-arena-dim" htmlFor="on-deck-club-name">
            Club name
          </label>
          <input
            id="on-deck-club-name"
            name="name"
            className="od-field"
            value={clubName}
            maxLength={120}
            onChange={(event) => setClubName(event.target.value)}
            required
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="od-readout text-arena-dim" htmlFor="on-deck-venue">
            Venue name
          </label>
          <input
            id="on-deck-venue"
            name="venueName"
            className="od-field"
            value={venue}
            maxLength={120}
            onChange={(event) => setVenue(event.target.value)}
            required
          />
        </div>

        <div className="flex flex-wrap gap-5">
          <div className="flex flex-col gap-2">
            <label
              className="od-readout text-arena-dim"
              htmlFor="on-deck-court-count"
            >
              Courts
            </label>
            <input
              id="on-deck-court-count"
              name="courtCount"
              className="od-field w-[6.5rem]"
              type="number"
              inputMode="numeric"
              min={1}
              max={40}
              value={courts}
              onChange={(event) => setCourts(event.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <label
              className="od-readout text-arena-dim"
              htmlFor="on-deck-group-cap"
            >
              Group cap
            </label>
            <input
              id="on-deck-group-cap"
              name="groupCap"
              className="od-field w-[6.5rem]"
              type="number"
              inputMode="numeric"
              min={2}
              max={8}
              value={cap}
              onChange={(event) => setCap(event.target.value)}
              required
            />
          </div>
        </div>

        <p className="od-bo-note -mt-2">
          The group cap is the biggest group a player or volunteer can queue
          together. Every session starts from these unless you set one up ahead
          of time with its own venue or court count.
        </p>

        <div className="flex flex-col gap-2">
          <label
            className="od-readout text-arena-dim"
            htmlFor="on-deck-floor-mode"
          >
            Floor Mode
          </label>
          <select
            id="on-deck-floor-mode"
            name="floorMode"
            className="od-select sm:max-w-[18rem]"
            value={mode}
            onChange={(event) => setMode(event.target.value as FloorMode)}
            required
          >
            {FLOOR_MODES.map((value) => (
              <option key={value} value={value}>
                {FLOOR_MODE_LABEL[value]}
              </option>
            ))}
          </select>
          <p className="od-bo-note">{FLOOR_MODE_BLURB[mode]}</p>
        </div>

        {error && (
          <p className="text-sm font-medium text-arena-warn" role="alert">
            {error}
          </p>
        )}
        {saved && (
          <p className="od-readout text-arena-next" role="status">
            Defaults saved.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <button
            type="submit"
            className="od-key od-key--go"
            disabled={pending}
          >
            {pending ? "Saving…" : "Save defaults"}
          </button>
          <Link
            href={ON_DECK_HOME_PATH}
            className="od-readout text-arena-dim underline decoration-arena-line underline-offset-4 transition-colors hover:text-arena-fg"
          >
            Back to tonight
          </Link>
        </div>
      </form>
    </Stage>
  );
}
