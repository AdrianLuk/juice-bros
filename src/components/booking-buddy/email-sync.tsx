"use client";

import type { ReactNode } from "react";
import { useActionState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
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
import { ActionError } from "@/components/booking-buddy/action-error";
import type { ActionResult } from "@/lib/booking-buddy/actions/result";
import {
  connectMailbox,
  disconnectMailbox,
  type MailboxLink,
} from "@/lib/booking-buddy/actions/email-sync";
import {
  MAILBOX_PROVIDER_IDENTITY_LABEL,
  MAILBOX_PROVIDER_LABEL,
  type MailboxProvider,
} from "@/lib/booking-buddy/mailbox-provider";

const EMPTY: ActionResult = {};

/**
 * Brand glyphs as inline SVG — Booking Buddy's icon set (lucide) carries no
 * brand marks, and the spec wants each connect option visually tagged with the
 * inbox it opens. Monochrome-on-brand-colour, `aria-hidden` (the button label
 * already names the provider).
 */
function GmailIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 shrink-0" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M22 5.5v13a1.5 1.5 0 0 1-1.5 1.5H18V9.6l-6 4.5-6-4.5V20H3.5A1.5 1.5 0 0 1 2 18.5v-13A1.5 1.5 0 0 1 3.5 4h.6L12 10l7.9-6h.6A1.5 1.5 0 0 1 22 5.5Z"
      />
    </svg>
  );
}

function OutlookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 shrink-0" aria-hidden="true">
      <path
        fill="#0078D4"
        d="M13 4h7a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-7v-4.2l3.2 2.1L21 15V9l-4.8-2.9L13 8.2V4Z"
      />
      <path
        fill="#0078D4"
        d="M2 6l9-2v16l-9-2V6Zm4.5 3.2c-1.3 0-2.2 1.2-2.2 2.9s.9 2.8 2.2 2.8 2.2-1.1 2.2-2.9-.9-2.8-2.2-2.8Zm0 1.3c.6 0 1 .6 1 1.5s-.4 1.6-1 1.6-1-.6-1-1.6.4-1.5 1-1.5Z"
      />
    </svg>
  );
}

const PROVIDER_ICON: Record<MailboxProvider, () => ReactNode> = {
  google: GmailIcon,
  microsoft: OutlookIcon,
};

/**
 * The one-line heads-up before each consent screen — until publisher
 * verification is done for both apps, a User picking either option lands on a
 * scary-looking warning and needs to know it's expected and how to get past it.
 */
const UNVERIFIED_APP_NOTE: Record<MailboxProvider, string> = {
  google:
    "Google has not reviewed this app yet, so its consent screen shows a warning. Choose Advanced, then Go to Booking Buddy.",
  microsoft:
    "Microsoft shows an unverified-app notice on the consent screen. Check the listed permissions, then choose Accept.",
};

// "email_sync_not_allowed" isn't handled here: the Settings page renders its
// own standalone banner for that case (with a Request-access link), since the
// section stays visible to every User now and that error is Gmail-only.
function errorMessage(error: string | undefined): string | null {
  switch (error) {
    case "mailbox_connect_failed":
      return "Couldn't connect that mailbox. Try again.";
    default:
      return null;
  }
}

function ProviderConnectButton({ provider }: { provider: MailboxProvider }) {
  const Icon = PROVIDER_ICON[provider];

  return (
    <div className="flex flex-col gap-1.5">
      <form action={connectMailbox.bind(null, provider)}>
        <Button type="submit" variant="outline" className="gap-2">
          <Icon />
          Connect {MAILBOX_PROVIDER_LABEL[provider]}
        </Button>
      </form>
      <p className="text-xs text-muted-foreground">
        {UNVERIFIED_APP_NOTE[provider]}
      </p>
    </div>
  );
}

/**
 * "Sync from Email" section of Settings (spec #280). Visible to every User: the
 * Gmail option only renders for an allowlisted one (ADR-0009's Testing-mode
 * cap), the Outlook option only when the Microsoft OAuth client is configured.
 * `connectMailbox` and the callback route re-check both of those authoritatively.
 *
 * Only the connect/disconnect pipe lives here — the "Sync from Email" button,
 * the candidates, and the review screen are on the Bookings page.
 */
export function MailboxSyncSection({
  mailboxLink,
  gmailConnectAllowed,
  outlookConnectConfigured,
  error,
  justConnected,
}: {
  mailboxLink: MailboxLink;
  gmailConnectAllowed: boolean;
  outlookConnectConfigured: boolean;
  error?: string;
  justConnected?: boolean;
}) {
  const [state, disconnectAction, pending] = useActionState(
    disconnectMailbox,
    EMPTY,
  );
  const message = errorMessage(error);

  const connectableProviders: MailboxProvider[] = [
    ...(gmailConnectAllowed ? (["google"] as const) : []),
    ...(outlookConnectConfigured ? (["microsoft"] as const) : []),
  ];

  let body: ReactNode;

  if (mailboxLink) {
    const providerLabel = MAILBOX_PROVIDER_LABEL[mailboxLink.provider];
    const identityLabel = MAILBOX_PROVIDER_IDENTITY_LABEL[mailboxLink.provider];

    body = (
      <div className="flex flex-col gap-3">
        <p className="text-sm">
          Connected as{" "}
          <span className="font-medium">{mailboxLink.accountEmail}</span> via{" "}
          {providerLabel}
          {mailboxLink.status === "expired" && (
            <span className="ml-2 text-destructive">
              ({identityLabel} needs you to reconnect)
            </span>
          )}
        </p>

        <div className="flex flex-wrap items-center gap-3">
          {mailboxLink.status === "expired" && (
            <form action={connectMailbox.bind(null, mailboxLink.provider)}>
              <Button type="submit" variant="outline">
                Reconnect {providerLabel}
              </Button>
            </form>
          )}
          <AlertDialog>
            <AlertDialogTrigger
              render={<Button variant="destructive" disabled={pending} />}
            >
              {pending ? "Disconnecting…" : "Disconnect"}
            </AlertDialogTrigger>
            <AlertDialogContent className="bb-theme">
              <AlertDialogHeader>
                <AlertDialogTitle>Disconnect this mailbox?</AlertDialogTitle>
                <AlertDialogDescription>
                  Booking Buddy stops reading{" "}
                  <span className="font-medium">{mailboxLink.accountEmail}</span>{" "}
                  for CourtReserve emails. Bookings already pulled in stay put.
                  You can reconnect anytime.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep connected</AlertDialogCancel>
                {/* The form lives inside the dialog so the confirm button is
                    the only thing that can submit it. */}
                <form
                  action={disconnectAction}
                  className="flex flex-col gap-1 sm:items-end"
                >
                  <Button
                    type="submit"
                    variant="destructive"
                    disabled={pending}
                  >
                    {pending ? "Disconnecting…" : "Disconnect"}
                  </Button>
                  <ActionError state={state} />
                </form>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    );
  } else if (connectableProviders.length === 0) {
    body = (
      <p className="text-sm text-muted-foreground">
        Email sync reads your CourtReserve confirmation emails and pulls those
        bookings in for you. The Gmail option is invite-only right now.{" "}
        <Link
          href="/contact"
          className="text-foreground underline underline-offset-2"
        >
          Request access
        </Link>
        .
      </p>
    );
  } else {
    body = (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Connect the inbox your CourtReserve confirmation emails go to, and
          Booking Buddy can pull those reservations in without you typing them
          by hand.
        </p>
        <div className="flex flex-col gap-4">
          {connectableProviders.map((provider) => (
            <ProviderConnectButton key={provider} provider={provider} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {message && (
        <p className="text-sm text-destructive" role="alert">
          {message}
        </p>
      )}
      {justConnected && !message && (
        <p className="text-sm text-muted-foreground" role="status">
          Mailbox connected.
        </p>
      )}
      {body}
    </div>
  );
}
