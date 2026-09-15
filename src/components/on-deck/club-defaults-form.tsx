"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveClubDefaults } from "@/lib/on-deck/actions/sessions";
import { ON_DECK_HOME_PATH } from "@/lib/on-deck/routes";
import {
  FLOOR_MODES,
  FLOOR_MODE_LABEL,
  type ClubDefaults,
  type FloorMode,
} from "@/lib/on-deck/session/types";

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
 * accident; now the name is typed into a two-field form by somebody who has
 * not run a night yet, and the floor mode is nobody's choice at all until it
 * is made here.
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
    <form onSubmit={submit} className="mt-8 flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="on-deck-club-name">Club name</Label>
        <Input
          id="on-deck-club-name"
          name="name"
          value={clubName}
          maxLength={120}
          onChange={(event) => setClubName(event.target.value)}
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="on-deck-venue">Venue name</Label>
        <Input
          id="on-deck-venue"
          name="venueName"
          value={venue}
          maxLength={120}
          onChange={(event) => setVenue(event.target.value)}
          required
        />
      </div>

      <div className="flex gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="on-deck-court-count">Courts</Label>
          <Input
            id="on-deck-court-count"
            name="courtCount"
            type="number"
            inputMode="numeric"
            min={1}
            max={40}
            className="w-24"
            value={courts}
            onChange={(event) => setCourts(event.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="on-deck-group-cap">Group cap</Label>
          <Input
            id="on-deck-group-cap"
            name="groupCap"
            type="number"
            inputMode="numeric"
            min={2}
            max={8}
            className="w-24"
            value={cap}
            onChange={(event) => setCap(event.target.value)}
            required
          />
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        The group cap is the biggest group a player or volunteer can queue
        together. Every session starts from these unless you set one up ahead of
        time with its own venue or court count.
      </p>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="on-deck-floor-mode">Floor Mode</Label>
        <select
          id="on-deck-floor-mode"
          name="floorMode"
          value={mode}
          onChange={(event) => setMode(event.target.value as FloorMode)}
          className="h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:w-64"
          required
        >
          {FLOOR_MODES.map((value) => (
            <option key={value} value={value}>
              {FLOOR_MODE_LABEL[value]}
            </option>
          ))}
        </select>
        <p className="text-sm text-muted-foreground">
          {FLOOR_MODE_BLURB[mode]}
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {saved && (
        <p className="text-sm text-brand-orange" role="status">
          Defaults saved.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending} className="h-11 px-6">
          {pending ? "Saving…" : "Save defaults"}
        </Button>
        <Link
          href={ON_DECK_HOME_PATH}
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Back to tonight
        </Link>
      </div>
    </form>
  );
}
