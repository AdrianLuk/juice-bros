"use client";

import { useEffect, useRef } from "react";

import { adoptDetectedTimeZone } from "@/lib/on-deck/actions/sessions";

/**
 * Establishes the Club's clock without ever asking (issue #469).
 *
 * A Session Summary has to name a day, and naming a day from a `timestamptz`
 * means knowing whose clock. The Organizer is the wrong person to ask: they
 * opened On Deck to run a pickleball night, and the browser in their hand
 * already holds the answer. So this reads it and posts it once.
 *
 * Renders nothing, and only mounts when the Club has no zone yet. The RPC
 * behind it writes only while the column is null, so a stale mount, a double
 * render, or an Organizer travelling with their laptop cannot overwrite a
 * clock somebody set deliberately. Settings keeps a picker for the case where
 * the guess is wrong, which is the one thing detection cannot fix by itself.
 */
export function AdoptTimeZone() {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    // In a browser this is always defined; the guard is for the render that
    // is not one.
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!zone) return;

    void adoptDetectedTimeZone(zone);
  }, []);

  return null;
}
