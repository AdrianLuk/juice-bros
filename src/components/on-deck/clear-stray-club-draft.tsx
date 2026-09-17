"use client";

import { useEffect } from "react";

import { clearClubDraftCookie } from "@/lib/on-deck/club-draft";

/**
 * Clears a leftover Club-draft cookie for an Organizer who already has a
 * Club (issue #520) — a client-side cookie delete, no server round trip,
 * since the cookie is not `httpOnly`. Mounted only when the page rendered a
 * Club. Unlike `AdoptTimeZone`'s equivalent effect, this needs no
 * once-only guard: deleting an already-deleted cookie is a no-op, so
 * React's double-invoke in development costs nothing. Renders nothing.
 */
export function ClearStrayClubDraft() {
  useEffect(() => {
    clearClubDraftCookie();
  }, []);

  return null;
}
