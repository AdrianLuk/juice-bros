"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PersonName } from "@/components/booking-buddy/connection-list";
import {
  VisibilitySelect,
  visibilityLabel,
} from "@/components/booking-buddy/visibility-select";
import { personLabel } from "@/lib/booking-buddy/connections";
import type { ActionResult } from "@/lib/booking-buddy/actions/result";
import {
  setFriendVisibilityOverride,
  type FriendVisibility,
} from "@/lib/booking-buddy/actions/friend-groups";

const EMPTY: ActionResult = {};

function ActionError({ state }: { state: ActionResult }) {
  if (!state.error) {
    return null;
  }

  return (
    <p className="text-xs text-destructive" role="alert">
      {state.error}
    </p>
  );
}

export function FriendVisibilityRow({
  friend,
  actions,
}: {
  friend: FriendVisibility;
  /** Row-level buttons unrelated to Visibility — e.g. "View calendar", "Remove". */
  actions?: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(
    setFriendVisibilityOverride,
    EMPTY,
  );
  const selectId = `friend-${friend.person.connectionId}-level`;

  return (
    <li className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <PersonName person={friend.person} />
        <p className="mt-0.5 text-xs text-muted-foreground">
          {friend.override
            ? `Set just for them: ${visibilityLabel(friend.resolved)}`
            : `From your groups: ${visibilityLabel(friend.resolved)}`}
        </p>
      </div>

      <div className="flex flex-col items-stretch gap-3 sm:items-end">
        {actions && (
          <div className="flex shrink-0 items-start gap-2 sm:justify-end">
            {actions}
          </div>
        )}

        <form action={formAction} className="flex flex-col items-stretch gap-1 sm:items-end">
          <input
            type="hidden"
            name="connection_id"
            value={friend.person.connectionId}
          />
          <div className="flex items-center gap-2">
            <Label htmlFor={selectId} className="sr-only">
              What {personLabel(friend.person)} can see
            </Label>
            {/* Keyed on the saved value so a successful save remounts the
                select — see the note on BookingWindowForm in orgs.tsx. */}
            <VisibilitySelect
              key={friend.override ?? "clear"}
              id={selectId}
              defaultValue={friend.override ?? "clear"}
              extraOptions={[{ value: "clear", label: "Use my group defaults" }]}
              className="sm:w-56"
            />
            <Button type="submit" size="sm" variant="outline" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
          <ActionError state={state} />
        </form>
      </div>
    </li>
  );
}
