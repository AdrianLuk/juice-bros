"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { ActionError } from "@/components/booking-buddy/action-error";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
  confirm,
}: {
  connectionId: string;
  action: keyof typeof ACTIONS;
  label: string;
  pendingLabel: string;
  variant?: "default" | "outline" | "ghost" | "destructive";
  /**
   * Puts the action behind a confirmation step. Worth it for unfriending,
   * which throws away an established Connection; not for declining or
   * cancelling a request, which the other person can simply send again.
   */
  confirm?: { title: string; description: string };
}) {
  const [state, formAction, pending] = useActionState(ACTIONS[action], EMPTY);

  // A real form, so the lists re-render from the server in the same roundtrip
  // — the actions call revalidatePath on this page.
  const form = (
    <form action={formAction} className="flex flex-col gap-1 sm:items-end">
      <input type="hidden" name="connection_id" value={connectionId} />
      <Button
        type="submit"
        size={confirm ? "default" : "sm"}
        variant={confirm ? "destructive" : variant}
        disabled={pending}
      >
        {pending ? pendingLabel : label}
      </Button>
      <ActionError state={state} />
    </form>
  );

  if (!confirm) {
    return form;
  }

  // The form moves inside the dialog so the only thing that can submit it is
  // the confirm button. The row's button merely opens the dialog, which is
  // what makes a stray click harmless.
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button size="sm" variant={variant} />}>
        {label}
      </AlertDialogTrigger>
      <AlertDialogContent className="bb-theme">
        <AlertDialogHeader>
          <AlertDialogTitle>{confirm.title}</AlertDialogTitle>
          <AlertDialogDescription>{confirm.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep friend</AlertDialogCancel>
          {form}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
