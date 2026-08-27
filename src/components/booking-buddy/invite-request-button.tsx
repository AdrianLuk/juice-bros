"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  sendConnectionRequest,
  type ActionResult,
} from "@/lib/booking-buddy/actions/connections";

const EMPTY: ActionResult = {};

/**
 * Sends a friend request to a join link's owner (issue #175). Reuses
 * `sendConnectionRequest` unchanged — including its duplicate-pending guard —
 * so opening a link you already have a request with just reports that.
 */
export function InviteRequestButton({
  ownerId,
  ownerName,
}: {
  ownerId: string;
  ownerName: string;
}) {
  const [state, formAction, pending] = useActionState(
    sendConnectionRequest,
    EMPTY,
  );

  if (state.ok) {
    return (
      <p className="text-sm text-muted-foreground">
        Friend request sent to {ownerName}. They&apos;ll need to accept it
        before you&apos;re connected.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col items-start gap-2">
      <input type="hidden" name="addressee_id" value={ownerId} />
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : `Send ${ownerName} a friend request`}
      </Button>
      {state.error && (
        <p className="text-xs text-destructive" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
