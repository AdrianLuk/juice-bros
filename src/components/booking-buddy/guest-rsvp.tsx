"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ResponseAnswer } from "@/lib/booking-buddy/responses";
import type { ActionResult } from "@/lib/booking-buddy/actions/result";
import {
  guestRespondViaLink,
  type GuestResponse,
} from "@/lib/booking-buddy/actions/guest-rsvp";

const EMPTY: ActionResult = {};

function ActionError({ state }: { state: ActionResult }) {
  if (!state.error) {
    return null;
  }

  return (
    <p className="text-xs text-red-600" role="alert">
      {state.error}
    </p>
  );
}

const ANSWER_LABEL: Record<ResponseAnswer, string> = {
  yes: "Yes",
  no: "No",
  maybe: "Maybe",
};

const ANSWERS: readonly ResponseAnswer[] = ["yes", "no", "maybe"];

/**
 * A Guest's RSVP: name plus yes/no/maybe, no account or Connection needed
 * (CONTEXT.md's Guest entry). A plain form posting to a Server Action — like
 * every other Booking Buddy form, this works with JavaScript off, which
 * matters more here than anywhere else in the app: a link pasted into a chat
 * app can land in any browser, including one where the Server Action's own
 * client-side enhancement never loads.
 */
export function GuestRsvpForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(guestRespondViaLink, EMPTY);

  if (state.ok) {
    return (
      <p className="rounded-lg border border-border px-4 py-3 text-sm" role="status">
        Thanks — your RSVP is in.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />

      <div className="flex min-w-0 flex-col gap-1.5">
        <Label htmlFor="guest-name">Your name</Label>
        <Input id="guest-name" name="guest_name" required maxLength={60} />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Are you in?</span>
        <div className="flex gap-2" role="group" aria-label="RSVP">
          {ANSWERS.map((answer) => (
            <Button
              key={answer}
              type="submit"
              name="answer"
              value={answer}
              variant={answer === "yes" ? "default" : "outline"}
              disabled={pending}
            >
              {pending ? "Sending…" : ANSWER_LABEL[answer]}
            </Button>
          ))}
        </div>
      </div>

      <ActionError state={state} />
    </form>
  );
}

export function GuestResponseList({ responses }: { responses: GuestResponse[] }) {
  if (responses.length === 0) {
    return <p className="text-sm text-muted-foreground">Nobody has responded yet.</p>;
  }

  return (
    <ul className="divide-y divide-border rounded-lg border border-border">
      {responses.map((response) => (
        <li
          key={response.key}
          className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
        >
          <span>{response.label}</span>
          <span className="text-muted-foreground">{ANSWER_LABEL[response.answer]}</span>
        </li>
      ))}
    </ul>
  );
}
