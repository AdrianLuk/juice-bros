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
};

/**
 * The Club's saved Session defaults (issue #254, user story 44) — venue, court
 * count, group cap. Every one-tap Start reads from here, and an unedited
 * scheduled Session inherits them.
 */
export function ClubDefaultsForm({ venueName, courtCount, groupCap }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [venue, setVenue] = useState(venueName);
  const [courts, setCourts] = useState(String(courtCount));
  const [cap, setCap] = useState(String(groupCap));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveClubDefaults({
        venueName: venue,
        courtCount: Number(courts),
        groupCap: Number(cap),
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
