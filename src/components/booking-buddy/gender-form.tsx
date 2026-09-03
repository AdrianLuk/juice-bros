"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { GENDERS, GENDER_LABEL, type Gender } from "@/lib/booking-buddy/gender";
import { updateGender } from "@/lib/booking-buddy/actions/profile";
import type { ActionResult } from "@/lib/booking-buddy/actions/result";

const EMPTY: ActionResult = {};

/** The radiogroup's own three choices — "unset" is the form's own name for a `null` Gender, not a fourth real value. */
type GenderChoice = Gender | "unset";

/**
 * Gender (issue #79) — optional and self-reported, the prerequisite for a
 * gender-aware Capacity signal on mixed/men's/women's Slots (#80). A
 * separate form from `UsernameForm`, same radiogroup pattern
 * `DurationPicker` (bookings.tsx) already uses, so "Prefer not to say" is a
 * real, equally-weighted choice rather than an empty placeholder state.
 */
export function GenderForm({ gender }: { gender: Gender | null }) {
  const [state, formAction, pending] = useActionState(updateGender, EMPTY);
  const [choice, setChoice] = useState<GenderChoice>(gender ?? "unset");

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label>Gender</Label>
        <div
          className="flex flex-wrap gap-1.5"
          role="radiogroup"
          aria-label="Gender"
        >
          <Button
            type="button"
            variant={choice === "unset" ? "default" : "outline"}
            role="radio"
            aria-checked={choice === "unset"}
            onClick={() => setChoice("unset")}
          >
            Prefer not to say
          </Button>
          {GENDERS.map((value) => (
            <Button
              key={value}
              type="button"
              variant={choice === value ? "default" : "outline"}
              role="radio"
              aria-checked={choice === value}
              onClick={() => setChoice(value)}
            >
              {GENDER_LABEL[value]}
            </Button>
          ))}
        </div>
        <input
          type="hidden"
          name="gender"
          value={choice === "unset" ? "" : choice}
        />
      </div>

      <p className="text-sm text-muted-foreground">
        Used to show a gender-aware sign-up count on
        mixed/men&apos;s/women&apos;s games. Optional, and leaving this unset is
        fine.
      </p>

      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}

      {state.ok && (
        <p className="text-sm text-muted-foreground" role="status">
          Saved.
        </p>
      )}

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save gender"}
        </Button>
      </div>
    </form>
  );
}
