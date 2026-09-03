"use client";

import { useState, useSyncExternalStore } from "react";

import { FormSelect } from "@/components/booking-buddy/visibility-select";

/** A zone never changes mid-session, so there is nothing to subscribe to. */
const subscribeToNothing = () => () => {};

const readBrowserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * Which clock a hand-named Org's Bookings render on (issue #20 — asked once at
 * Org creation, not per Booking).
 *
 * A real, visible control rather than a hidden field, for two reasons. The
 * browser is the only thing that knows the User's zone — the server is on UTC
 * in production, and defaulting to it is exactly the bug this exists to
 * prevent — but a field filled in by script alone would break with JavaScript
 * off, which every other Booking Buddy form survives. This way script only
 * *preselects* it, and it stays auditable: an Org stored against the wrong
 * clock is invisible until somebody shows up hours late to every Booking under
 * it.
 *
 * The zone list is passed in from the server so both renders agree on it;
 * `Intl.supportedValuesOf` is free to differ between Node's ICU and the
 * browser's, and a hydration mismatch on a 600-option list is not worth
 * discovering later.
 */
export function TimeZoneSelect({ id, zones }: { id: string; zones: string[] }) {
  // The browser's own zone is a client-only fact, so it is read as one: the
  // server snapshot is empty, the client's is the real zone, and React swaps
  // them after hydration without either a mismatch or a cascading render.
  const detected = useSyncExternalStore(
    subscribeToNothing,
    readBrowserZone,
    () => "",
  );

  // The detected zone is added to the list when the list doesn't already have
  // it, rather than being discarded as unrecognised. The two sides disagree
  // more than you would hope: Node's ICU here lists 418 zones with the legacy
  // spellings only — `Asia/Calcutta`, `Europe/Kiev`, and no `UTC` at all —
  // while browsers report the canonical ids. Matching strictly against the
  // server's list left a Chrome user in India detected as `Asia/Kolkata`, no
  // match, the disabled placeholder selected, and `required` refusing to submit
  // a form whose list never contained their zone under a name they would look
  // for. Postgres accepts both spellings, so passing theirs straight through is
  // safe.
  const options =
    detected && !zones.includes(detected) ? [detected, ...zones] : zones;

  // Null until the User overrides the detection, so a later render can't
  // clobber a choice they made by hand.
  const [chosen, setChosen] = useState<string | null>(null);
  const zone = chosen ?? detected;

  return (
    <FormSelect
      id={id}
      name="time_zone"
      value={zone}
      onChange={(event) => setChosen(event.target.value)}
      required
    >
      <option value="" disabled>
        Pick your time zone
      </option>
      {options.map((value) => (
        <option key={value} value={value}>
          {value.replaceAll("_", " ")}
        </option>
      ))}
    </FormSelect>
  );
}
