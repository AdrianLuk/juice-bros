"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveClubDefaults } from "@/lib/on-deck/actions/sessions";
import { ON_DECK_HOME_PATH } from "@/lib/on-deck/routes";

type Props = {
  venueName: string;
  courtCount: number;
  groupCap: number;
  /** The Club's clock, or null if it has not been established yet. */
  timeZone: string | null;
  /** Every zone this runtime knows, resolved on the server (see below). */
  zones: string[];
};

/**
 * The Club's saved Session defaults (issue #254, user story 44) — venue, court
 * count, group cap, and the Club's clock (issue #469). Every one-tap Start
 * reads from here, and an unedited scheduled Session inherits them.
 *
 * The clock is a correction, not a setup step: `AdoptTimeZone` has already
 * taken it off the Organizer's own browser by the time anyone opens this page.
 * It stays visible because detection has exactly one failure mode it cannot
 * fix by itself, which is being wrong.
 *
 * The zone list is resolved on the server and passed in, so both renders agree
 * on it: `Intl.supportedValuesOf` is free to differ between Node's ICU build
 * and the browser's, and a hydration mismatch across a 400-option list is not
 * worth discovering in production. Same reasoning as Booking Buddy's
 * `TimeZoneSelect`, which this deliberately does not import (CONTEXT-MAP.md).
 */
export function ClubDefaultsForm({
  venueName,
  courtCount,
  groupCap,
  timeZone,
  zones,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [venue, setVenue] = useState(venueName);
  const [courts, setCourts] = useState(String(courtCount));
  const [cap, setCap] = useState(String(groupCap));
  // Falls back to this browser's own zone, which is what the Club would have
  // adopted anyway. An Organizer opening Settings should find their clock
  // already right, not a blank they have to reason about.
  const [zone, setZone] = useState(
    timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC",
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // The Club's own zone is always offered, even if this runtime's ICU build
  // does not list it: a stored zone that vanished from the picker would be
  // silently replaced by whatever sorted first.
  const options = Array.from(new Set([zone, ...zones])).sort();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveClubDefaults({
        venueName: venue,
        courtCount: Number(courts),
        groupCap: Number(cap),
        timeZone: zone,
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
        The biggest group a player or volunteer can queue together. Every session
        starts from these unless you set one up ahead of time with its own venue
        or court count.
      </p>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="on-deck-time-zone">Time zone</Label>
        <select
          id="on-deck-time-zone"
          name="timeZone"
          value={zone}
          onChange={(event) => setZone(event.target.value)}
          className="h-10 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          required
        >
          {options.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <p className="text-sm text-muted-foreground">
          Which clock a finished night is dated on. Already set from the device
          you first signed in on, so this only needs touching if that was the
          wrong one.
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
