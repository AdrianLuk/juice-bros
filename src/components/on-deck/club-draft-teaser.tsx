"use client";

import { useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CLUB_NAME_MAX,
  COURT_COUNT_DIGITS,
  COURT_COUNT_RANGE,
  writeClubDraftCookie,
  type ClubDraft,
} from "@/lib/on-deck/club-draft";

/**
 * A Club name and court count, typed before signing in (issue #520) — a
 * sibling of the sign-in form rather than a field inside it, so
 * authentication stays that component's only concern. Written straight to a
 * cookie on every change: whichever sign-in method the Organizer actually
 * uses never has to touch these two fields itself, and `/on-deck/home`'s
 * create form picks the cookie back up afterward.
 */
export function ClubDraftTeaser({
  initialDraft,
}: {
  /** Whatever is already sitting in the draft cookie — shown here, not just
   * seeded silently into the create-club form later, so a stray draft left
   * by a previous visitor on a shared browser is something this Organizer
   * can see and correct before it becomes their Club's name. */
  initialDraft?: ClubDraft | null;
}) {
  const [draft, setDraft] = useState<ClubDraft>(
    initialDraft ?? { name: "", courtCount: "" },
  );

  // The cookie write is a side effect of `draft` changing, not part of
  // computing it — keeping it out of `setDraft`'s updater (which React may
  // invoke more than once per update) means it only ever runs once per
  // actual change. Skipped on the render that mounts this component: `draft`
  // is "new" then too, but rewriting the cookie back to a value it already
  // held would just reset a stray draft's TTL on every plain page view that
  // never touched either field.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    writeClubDraftCookie(draft);
  }, [draft]);

  function update(changes: Partial<ClubDraft>) {
    // Off `prev`, not this closure's own `draft` — two `onChange`s landing in
    // the same React batch (an autofill filling both fields at once) would
    // otherwise let the second call overwrite the first field's just-typed
    // value with what this render started with.
    setDraft((prev) => ({ ...prev, ...changes }));
  }

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-xl border border-dashed p-4">
      <p className="text-sm text-muted-foreground">
        Setting up your own club? Tell us now, and it&apos;ll be ready to
        create the moment you&apos;re signed in.
      </p>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="draft-club-name">Club name</Label>
        <Input
          id="draft-club-name"
          value={draft.name}
          maxLength={CLUB_NAME_MAX}
          autoComplete="off"
          autoCapitalize="words"
          onChange={(event) => update({ name: event.target.value })}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="draft-club-courts">Courts</Label>
        <Input
          id="draft-club-courts"
          type="number"
          inputMode="numeric"
          min={COURT_COUNT_RANGE.min}
          max={COURT_COUNT_RANGE.max}
          className="max-w-[7.5rem]"
          value={draft.courtCount}
          onChange={(event) =>
            // Capped to the same length the cookie itself keeps, so what
            // this field shows can never end up longer than what actually
            // survives into the create-club form after sign-in.
            update({ courtCount: event.target.value.slice(0, COURT_COUNT_DIGITS) })
          }
        />
      </div>
    </div>
  );
}
