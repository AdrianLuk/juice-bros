"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  acceptConnectionRequest,
  removeConnection,
  type ActionResult,
} from "@/lib/booking-buddy/actions/connections";

const EMPTY: ActionResult = {};

/**
 * Declining a request, cancelling one you sent, and unfriending are the same
 * act on the same row, so one Server Action covers all three — only the label
 * changes.
 */
const ACTIONS = {
  accept: acceptConnectionRequest,
  remove: removeConnection,
} as const;

export function ConnectionActionButton({
  connectionId,
  action,
  label,
  pendingLabel,
  variant = "outline",
}: {
  connectionId: string;
  action: keyof typeof ACTIONS;
  label: string;
  pendingLabel: string;
  variant?: "default" | "outline" | "ghost";
}) {
  const [state, formAction, pending] = useActionState(ACTIONS[action], EMPTY);

  return (
    // A real form, so the lists re-render from the server in the same
    // roundtrip — the actions call revalidatePath on this page.
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="connection_id" value={connectionId} />
      <Button type="submit" size="sm" variant={variant} disabled={pending}>
        {pending ? pendingLabel : label}
      </Button>
      {state.error && (
        <p className="text-xs text-red-600" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
