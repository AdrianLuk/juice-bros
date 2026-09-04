"use client";

import { useActionState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ActionError } from "@/components/booking-buddy/action-error";
import { VisibilitySelect } from "@/components/booking-buddy/visibility-select";
import { GROUPS_PATH } from "@/lib/booking-buddy/routes";
import type { ActionResult } from "@/lib/booking-buddy/actions/result";
import { setDefaultFriendVisibility } from "@/lib/booking-buddy/actions/friend-groups";
import type { VisibilityLevel } from "@/lib/booking-buddy/visibility";

const EMPTY: ActionResult = {};

/**
 * The floor every friend starts from (ADR 0021) — `profiles.default_friend_visibility`.
 * Lowering it drops any friend still on the default immediately; raising it
 * restores them. A per-friend row below this can still pin one person above
 * or below whatever this is set to.
 */
export function DefaultVisibilityForm({ level }: { level: VisibilityLevel }) {
  const [state, formAction, pending] = useActionState(
    setDefaultFriendVisibility,
    EMPTY,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="default-visibility-level">Every friend starts at</Label>
        <div className="flex items-center gap-2">
          {/* Keyed on the saved value so a successful save remounts the
              select — see the note on BookingWindowForm in orgs.tsx. */}
          <VisibilitySelect
            key={level}
            id="default-visibility-level"
            defaultValue={level}
            className="sm:w-64"
          />
          <Button type="submit" size="sm" variant="outline" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
      <ActionError state={state} />
      <p className="text-xs text-muted-foreground">
        Need to raise just a few people above a lowered default?{" "}
        <Link href={GROUPS_PATH} className="underline underline-offset-4">
          Friend Groups (advanced)
        </Link>
        .
      </p>
    </form>
  );
}
