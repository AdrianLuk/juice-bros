"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/lib/booking-buddy/actions/result";
import { generateSlotLink, type SlotLink } from "@/lib/booking-buddy/actions/slot-links";

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

function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-live="polite"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Clipboard access can be denied (permissions, insecure context) —
          // the link is still plain selectable text in the field beside this.
        }
      }}
    >
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

/**
 * The Slot owner's own view of their Slot Link: create it if it doesn't
 * exist yet, or show it back with a one-click copy once it does.
 *
 * Only ever renders for the owner — `getSlotLink` is owner-gated by RLS, so
 * a friend viewing the same Slot detail page never reaches this component.
 */
export function SlotLinkPanel({
  slotId,
  slotLink,
}: {
  slotId: string;
  slotLink: SlotLink | null;
}) {
  const [state, formAction, pending] = useActionState(generateSlotLink, EMPTY);

  if (!slotLink) {
    return (
      <form action={formAction} className="flex flex-col items-start gap-2">
        <input type="hidden" name="slot_id" value={slotId} />
        <p className="text-sm text-muted-foreground">
          Anyone with this link can view the slot and RSVP by name — no account
          needed. Paste it into WhatsApp, iMessage, wherever.
        </p>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create invite link"}
        </Button>
        <ActionError state={state} />
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        Anyone with this link can view the slot and RSVP by name — no account
        needed. Paste it into WhatsApp, iMessage, wherever.
      </p>
      <div className="flex gap-2">
        <Input
          readOnly
          value={slotLink.url}
          onFocus={(event) => event.currentTarget.select()}
          className="font-mono text-xs"
          aria-label="Invite link"
        />
        <CopyLinkButton url={slotLink.url} />
      </div>
    </div>
  );
}
