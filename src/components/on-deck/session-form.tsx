"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  createScheduledSession,
  deleteScheduledSession,
  updateScheduledSession,
} from "@/lib/on-deck/actions/sessions";
import { ON_DECK_HOME_PATH } from "@/lib/on-deck/routes";
import { Stage } from "@/components/on-deck/back-office";

type Props = {
  /** Present when editing an existing scheduled Session. */
  sessionId?: string;
  scheduledFor?: string;
  venueName: string;
  courtCount: number;
};

/**
 * Create or edit a Session ahead of time (issue #254, user story 43; on the
 * board since #515). A scheduled Session carries its own date, venue, and court
 * count; group cap and Floor Mode stay Club settings. When its date arrives,
 * one-tap Start opens this Session with these values instead of the Club
 * defaults.
 */
export function SessionForm({
  sessionId,
  scheduledFor,
  venueName,
  courtCount,
}: Props) {
  const router = useRouter();
  const editing = Boolean(sessionId);
  const [pending, startTransition] = useTransition();
  const [removing, startRemoving] = useTransition();
  const [date, setDate] = useState(scheduledFor ?? "");
  const [venue, setVenue] = useState(venueName);
  const [courts, setCourts] = useState(String(courtCount));
  const [error, setError] = useState<string | null>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = editing
        ? await updateScheduledSession({
            sessionId: sessionId!,
            scheduledFor: date,
            venueName: venue,
            courtCount: Number(courts),
          })
        : await createScheduledSession({
            scheduledFor: date,
            venueName: venue,
            courtCount: Number(courts),
          });
      if (!result.ok) {
        setError(result.error ?? "Couldn't save. Try again.");
        return;
      }
      router.push(ON_DECK_HOME_PATH);
      router.refresh();
    });
  }

  function remove() {
    if (!sessionId) return;
    setError(null);
    startRemoving(async () => {
      const result = await deleteScheduledSession(sessionId);
      if (!result.ok) {
        setError(result.error ?? "Couldn't remove that session. Try again.");
        return;
      }
      router.push(ON_DECK_HOME_PATH);
      router.refresh();
    });
  }

  return (
    <Stage>
      <form onSubmit={submit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <label
            className="od-readout text-arena-dim"
            htmlFor="on-deck-session-date"
          >
            Date
          </label>
          <input
            id="on-deck-session-date"
            name="scheduledFor"
            type="date"
            className="od-field w-[12rem]"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            required
          />
        </div>

        <div className="flex flex-col gap-2">
          <label
            className="od-readout text-arena-dim"
            htmlFor="on-deck-session-venue"
          >
            Venue name
          </label>
          <input
            id="on-deck-session-venue"
            name="venueName"
            className="od-field"
            value={venue}
            maxLength={120}
            onChange={(event) => setVenue(event.target.value)}
            required
          />
        </div>

        <div className="flex flex-col gap-2">
          <label
            className="od-readout text-arena-dim"
            htmlFor="on-deck-session-courts"
          >
            Courts
          </label>
          <input
            id="on-deck-session-courts"
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

        <p className="od-bo-note">
          Group cap and floor mode come from your club settings. When this date
          arrives, tapping Start opens this session with these values.
        </p>

        {error && (
          <p className="text-sm font-medium text-arena-warn" role="alert">
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <button
            type="submit"
            className="od-key od-key--go"
            disabled={pending}
          >
            {pending ? "Saving…" : editing ? "Save changes" : "Schedule session"}
          </button>
          {editing && (
            <button
              type="button"
              className="od-key od-key--ghost"
              disabled={removing}
              onClick={remove}
            >
              {removing ? "Removing…" : "Remove"}
            </button>
          )}
          <Link
            href={ON_DECK_HOME_PATH}
            className="od-readout text-arena-dim underline decoration-arena-line underline-offset-4 transition-colors hover:text-arena-fg"
          >
            Cancel
          </Link>
        </div>
      </form>
    </Stage>
  );
}
