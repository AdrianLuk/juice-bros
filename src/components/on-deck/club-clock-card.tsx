"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { saveClubTimeZone } from "@/lib/on-deck/actions/sessions";

type Props = {
  /** The Club's clock, or null while nothing has established one yet. */
  timeZone: string | null;
  /** Every zone this runtime knows, resolved on the server (see below). */
  zones: string[];
};

/**
 * The Club's clock, shown as a fact and changed only on purpose (issue #469).
 *
 * By the time anyone opens Settings, `AdoptTimeZone` has already taken this
 * off the Organizer's own browser, so the normal state of this card is a
 * sentence rather than a control. The picker stays behind "Change" because
 * detection has exactly one failure mode it cannot fix by itself — being
 * wrong — and that case needs an escape hatch, not a setup step.
 *
 * It saves on its own rather than riding the defaults form. Sharing a submit
 * button would mean an Organizer changing their court count also commits
 * whatever zone the control happened to be showing.
 *
 * The zone list is resolved on the server and passed in so both renders agree
 * on it: `Intl.supportedValuesOf` is free to differ between Node's ICU build
 * and the browser's, and a hydration mismatch across a 400-option list is not
 * worth discovering in production.
 */
export function ClubClockCard({ timeZone, zones }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [zone, setZone] = useState(timeZone ?? "UTC");
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
      const result = await saveClubTimeZone(zone);
      if (!result.ok) {
        setError(result.error ?? "Couldn't save. Try again.");
        return;
      }
      setSaved(true);
      setEditing(false);
      router.refresh();
    });
  }

  return (
    <div className="mt-8 rounded-2xl border bg-card p-5">
      <h2 className="text-sm font-semibold">The club clock</h2>

      {!editing ? (
        <>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Nights are dated on{" "}
            <span className="text-foreground">{timeZone ?? "UTC"}</span>, set
            from the device you first signed in on. A session that runs to 8pm
            is the next day in UTC, so this is what keeps last Saturday from
            reading as Sunday.
          </p>
          {saved && (
            <p className="mt-2 text-sm text-brand-orange" role="status">
              Time zone saved.
            </p>
          )}
          <button
            type="button"
            className="mt-3 text-sm underline underline-offset-4"
            onClick={() => setEditing(true)}
          >
            Change it
          </button>
        </>
      ) : (
        <form onSubmit={submit} className="mt-3 flex flex-col gap-3">
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
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save time zone"}
            </Button>
            <button
              type="button"
              className="text-sm underline underline-offset-4"
              onClick={() => {
                setZone(timeZone ?? "UTC");
                setEditing(false);
                setError(null);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
