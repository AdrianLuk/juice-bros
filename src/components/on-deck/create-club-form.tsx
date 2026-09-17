"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createClub } from "@/lib/on-deck/actions/sessions";
import {
  BoardHead,
  HANDOFF_KEY,
  Stage,
} from "@/components/on-deck/back-office";

/**
 * The Organizer's own Club, in two fields (issue #515).
 *
 * What used to sit here was a panel saying On Deck clubs are made by hand and
 * to get in touch. Two questions instead, and neither needs a night to have
 * happened first: what the club is called, and how many courts. The venue
 * starts as the club's name, the group cap and floor mode take their defaults,
 * and the clock comes off this browser on the next load. Settings can correct
 * every one of them.
 *
 * It owns the page's heading as well as the panel, because the heading *is* the
 * club's name, and here the name does not exist yet. What gets typed into the
 * first field is rendered above it at board scale, in the same type the sign on
 * the wall and the screen at the venue will use. One Club per account and no
 * way to delete one, so the last thing this form should do is commit a name its
 * owner has only ever seen at 15px inside an input.
 *
 * On success the Organizer stays where they are and the page re-renders as
 * their Club, with Start on it.
 */
export function CreateClubForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [courts, setCourts] = useState("");
  const [error, setError] = useState<string | null>(null);

  const courtCount = Number(courts);
  const courtsValid = Number.isInteger(courtCount) && courtCount > 0;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createClub({ name, courtCount: Number(courts) });
      if (!result.ok) {
        setError(result.error ?? "Couldn't create your club. Try again.");
        return;
      }
      try {
        sessionStorage.setItem(HANDOFF_KEY, "1");
      } catch {
        // A browser refusing session storage costs a focus hop, nothing more.
      }
      router.refresh();
    });
  }

  return (
    <>
      <BoardHead
        name={name}
        resting="Your club"
        // Facts only, and there are none until a court count is typed. This
        // is the readout voice: a phrase naming the state ("new club") in it
        // is the board's clipboard worn as costume, and sitting one line under
        // the h1 it reads as the eyebrow the craft floor bans outright.
        spec={
          courtsValid
            ? [`${courtCount} ${courtCount === 1 ? "court" : "courts"}`]
            : []
        }
      />

      <Stage>
        <p className="od-bo-note">
          Two things and you can start a session tonight. Everything else takes a
          sensible default, and all of it is editable in settings.
        </p>

        <form onSubmit={submit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label className="od-readout text-arena-dim" htmlFor="od-club-name">
              Club name
            </label>
            <input
              id="od-club-name"
              name="name"
              className="od-field"
              value={name}
              maxLength={120}
              autoComplete="off"
              autoCapitalize="words"
              onChange={(event) => setName(event.target.value)}
              required
            />
            <p className="od-bo-hint">
              What your players call it, for example Riverside Pickleball. It
              goes on your sign and on the link you share with them.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <label
              className="od-readout text-arena-dim"
              htmlFor="od-club-courts"
            >
              Courts
            </label>
            <input
              id="od-club-courts"
              name="courtCount"
              className="od-field max-w-[7.5rem]"
              type="number"
              inputMode="numeric"
              min={1}
              max={40}
              value={courts}
              onChange={(event) => setCourts(event.target.value)}
              required
            />
            <p className="od-bo-hint">
              How many you play on in a usual week. A one-off night can have its
              own number.
            </p>
          </div>

          {error && (
            <p className="text-sm font-medium text-arena-warn" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="od-key od-key--go od-key--turnover"
            disabled={pending}
          >
            {pending ? "Creating…" : "Create the club"}
          </button>
        </form>
      </Stage>
    </>
  );
}
