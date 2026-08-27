"use client";

import { useActionState, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  rotateInviteToken,
  type RotateInviteResult,
} from "@/lib/booking-buddy/actions/invite-links";

const EMPTY: RotateInviteResult = {};

function CopyButton({ url }: { url: string }) {
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
          // Clipboard can be denied (permissions, insecure context) — the URL
          // is still selectable text in the field beside this.
        }
      }}
    >
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

/**
 * A User's own personal invite link (issue #175): shown on the Friends page
 * and in onboarding so a cold-start User with no one to search for still has
 * a way to bring friends in. "Reset link" rotates the token, cutting off a
 * link that's been shared too widely — behind a one-tap confirm, since an
 * accidental reset means chasing everyone with the new URL.
 *
 * `url` comes pre-built from the server; after a reset the fresh URL from the
 * action's own result takes over, so the field updates with no reload.
 */
export function InviteLinkPanel({ url: initialUrl }: { url: string }) {
  const [state, formAction, pending] = useActionState(rotateInviteToken, EMPTY);
  const [confirming, setConfirming] = useState(false);
  const url = state.url ?? initialUrl;

  useEffect(() => {
    // Collapse the confirm row once the action resolves — success or failure,
    // the moment for it has passed. Syncing UI to an external result, the same
    // shape as onboarding-modal.tsx's localStorage read.
    if (state.ok || state.error) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot collapse on action settle
      setConfirming(false);
    }
  }, [state]);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        Send this to someone you play with. When they sign up, you get a friend
        request to accept.
      </p>
      <div className="flex gap-2">
        <Input
          readOnly
          value={url}
          onFocus={(event) => event.currentTarget.select()}
          className="font-mono text-xs"
          aria-label="Your invite link"
        />
        <CopyButton url={url} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {confirming ? (
          <form action={formAction} className="flex flex-wrap items-center gap-2">
            <Button type="submit" variant="destructive" size="sm" disabled={pending}>
              {pending ? "Resetting…" : "Reset — the old link stops working"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setConfirming(false)}
            >
              Cancel
            </Button>
          </form>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setConfirming(true)}
          >
            Reset link
          </Button>
        )}

        {state.error && (
          <p className="text-xs text-destructive" role="alert">
            {state.error}
          </p>
        )}
      </div>
    </div>
  );
}
