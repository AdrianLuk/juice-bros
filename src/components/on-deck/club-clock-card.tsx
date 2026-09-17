"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { saveClubTimeZone } from "@/lib/on-deck/actions/sessions";
import { Stage, StageHeading } from "@/components/on-deck/back-office";

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

  // This card swaps its whole body in place, so the control the keyboard was
  // on gets unmounted under it and focus falls to <body>. Without this, opening
  // the picker means tabbing back down from the top of the page to reach the
  // select that just appeared, and closing it strands you at the top again.
  const selectRef = useRef<HTMLSelectElement>(null);
  const changeRef = useRef<HTMLButtonElement>(null);
  const moveFocus = useRef(false);

  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    (editing ? selectRef.current : changeRef.current)?.focus();
  }, [editing]);

  function setEditingFocused(next: boolean) {
    moveFocus.current = true;
    setEditing(next);
  }

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
      setEditingFocused(false);
      router.refresh();
    });
  }

  return (
    <Stage tone="flat">
      <StageHeading>The club clock</StageHeading>

      {!editing ? (
        <>
          <p className="od-bo-note">
            Nights are dated on <strong>{timeZone ?? "UTC"}</strong>, taken from
            the device you first signed in on. A session that runs to 8pm is the
            next day in UTC, so this is what keeps last Saturday from reading as
            Sunday.
          </p>
          {saved && (
            <p className="od-readout text-arena-next" role="status">
              Time zone saved.
            </p>
          )}
          <div>
            <button
              ref={changeRef}
              type="button"
              className="od-key od-key--ghost"
              onClick={() => setEditingFocused(true)}
            >
              Change it
            </button>
          </div>
        </>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label
              className="od-readout text-arena-dim"
              htmlFor="on-deck-time-zone"
            >
              Time zone
            </label>
            <select
              ref={selectRef}
              id="on-deck-time-zone"
              name="timeZone"
              value={zone}
              onChange={(event) => setZone(event.target.value)}
              className="od-select sm:max-w-[20rem]"
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
            <p className="text-sm font-medium text-arena-warn" role="alert">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <button
              type="submit"
              className="od-key od-key--go"
              disabled={pending}
            >
              {pending ? "Saving…" : "Save time zone"}
            </button>
            <button
              type="button"
              className="od-readout text-arena-dim underline decoration-arena-line underline-offset-4 transition-colors hover:text-arena-fg"
              onClick={() => {
                setZone(timeZone ?? "UTC");
                setEditingFocused(false);
                setError(null);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </Stage>
  );
}
