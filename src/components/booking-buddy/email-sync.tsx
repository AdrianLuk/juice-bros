"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/booking-buddy/actions/result";
import {
  connectGmail,
  disconnectGmail,
  type MailboxLink,
} from "@/lib/booking-buddy/actions/email-sync";

const EMPTY: ActionResult = {};

// "email_sync_not_allowed" isn't handled here: this component only ever
// renders when the Settings page has already decided the caller is
// allowed, so that error (raised by connectGmail's own authoritative
// re-check) can't occur while this is on screen — see the page's own
// standalone banner for that case.
function errorMessage(error: string | undefined): string | null {
  switch (error) {
    case "gmail_connect_failed":
      return "Couldn't connect Gmail. Try again.";
    default:
      return null;
  }
}

/**
 * "Sync from Email" section of Settings (issue #62). Only ever rendered for
 * an allowlisted User — the page decides that before this component exists
 * on the page at all, so there's nothing here checking it a second time.
 *
 * Only the connect/disconnect pipe ships in this ticket: no "Sync from
 * Email" button yet, no candidates, no review screen — that's #64.
 */
export function GmailSyncSection({
  mailboxLink,
  error,
  justConnected,
}: {
  mailboxLink: MailboxLink;
  error?: string;
  justConnected?: boolean;
}) {
  const [state, disconnectAction, pending] = useActionState(disconnectGmail, EMPTY);
  const message = errorMessage(error);

  return (
    <div className="flex flex-col gap-4">
      {message && (
        <p className="text-sm text-destructive" role="alert">
          {message}
        </p>
      )}
      {justConnected && !message && (
        <p className="text-sm text-muted-foreground" role="status">
          Gmail connected.
        </p>
      )}

      {mailboxLink ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm">
            Connected as <span className="font-medium">{mailboxLink.googleAccountEmail}</span>
            {mailboxLink.status === "expired" && (
              <span className="ml-2 text-destructive">
                (Google needs you to reconnect)
              </span>
            )}
          </p>

          <div className="flex flex-wrap items-center gap-3">
            {mailboxLink.status === "expired" && (
              <form action={connectGmail}>
                <Button type="submit" variant="outline">
                  Reconnect Gmail
                </Button>
              </form>
            )}
            <form action={disconnectAction}>
              <Button type="submit" variant="outline" disabled={pending}>
                {pending ? "Disconnecting…" : "Disconnect"}
              </Button>
            </form>
          </div>

          {state.error && (
            <p className="text-xs text-destructive" role="alert">
              {state.error}
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Connect your Gmail account to pull in bookings you&apos;ve already made
            at CourtReserve-powered facilities, without typing them in by hand.
          </p>
          <form action={connectGmail}>
            <Button type="submit" variant="outline">
              Connect Gmail
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
