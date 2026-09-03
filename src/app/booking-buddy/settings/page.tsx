import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/metadata";
import { BbPageHeading } from "@/components/booking-buddy/bb/page-heading";
import { BbSectionNav } from "@/components/booking-buddy/bb-section-nav";
import { SignOutButton } from "@/components/booking-buddy/sign-out-button";
import { UsernameForm } from "@/components/booking-buddy/username-form";
import { GenderForm } from "@/components/booking-buddy/gender-form";
import { NotificationPreferencesForm } from "@/components/booking-buddy/reminders";
import { PushNotificationsForm } from "@/components/booking-buddy/push-notifications";
import { MailboxSyncSection } from "@/components/booking-buddy/email-sync";
import { BbFooter } from "@/components/booking-buddy/bb-footer";
import { verifySession } from "@/lib/booking-buddy/dal";
import { getOwnProfile } from "@/lib/booking-buddy/actions/profile";
import { getNotificationPreferences } from "@/lib/booking-buddy/actions/reminders";
import { getMailboxLink } from "@/lib/booking-buddy/actions/email-sync";
import { isGmailConnectAllowed } from "@/lib/booking-buddy/email-sync-allowlist";
import {
  readEmailSyncAllowlist,
  readMicrosoftOAuthClientId,
} from "@/lib/booking-buddy/env";
export const metadata: Metadata = pageMetadata({
  title: "Settings",
  description: "Change the username friends use to find you on Booking Buddy.",
  path: "/booking-buddy/settings",
});
export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; mailbox_connected?: string }>;
}) {
  // Authoritative check. The proxy already bounced signed-out visitors, but
  // that check is optimistic and must not be relied on alone.
  const session = await verifySession();
  const { error, mailbox_connected: justConnected } = await searchParams;
  const [profile, notificationPreferences] = await Promise.all([
    getOwnProfile(),
    getNotificationPreferences(),
  ]);
  // The section itself is visible to everyone now (spec #280). Within it, the
  // Gmail connect option is the allowlist-gated part (ADR-0009's addendum —
  // Google's Testing-mode cap) and the Outlook option self-gates on whether the
  // Microsoft OAuth client is configured, the same shape the optional Google
  // sign-in button uses. `connectMailbox` and the callback re-check both
  // authoritatively. The allowlist check reuses the profile/session already
  // fetched above rather than calling isGmailConnectAllowedForCaller, which
  // would fetch them a second time.
  const gmailConnectAllowed = isGmailConnectAllowed(
    profile.username,
    session.email,
    readEmailSyncAllowlist(),
  );
  const outlookConnectConfigured = readMicrosoftOAuthClientId() !== undefined;
  const mailboxLink = await getMailboxLink();
  return (
    <div className="flex w-full flex-1 flex-col">
      <section className="w-full px-2.5 pt-6 pb-16 sm:px-6 sm:pt-16 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <BbPageHeading
            title="Settings"
            description="Your username was picked for you when you signed up. Change it to whatever you'd rather give out."
          />
          <BbSectionNav />
          <div className="bb-card mt-9 p-4 sm:p-6">
            <UsernameForm username={profile.username} />
          </div>
          <div className="bb-card mt-8 p-4 sm:p-6">
            <GenderForm gender={profile.gender} />
          </div>
          <div className="mt-8">
            <h2 className="bb-h text-[1.05rem]">Notifications</h2>
            <div className="bb-card mt-4 flex flex-col divide-y divide-border/60 p-6">
              <div className="pb-5">
                <PushNotificationsForm />
              </div>
              <div className="pt-5">
                <NotificationPreferencesForm
                  preferences={notificationPreferences}
                />
              </div>
            </div>
          </div>
          <div className="mt-8">
            <h2 className="bb-h text-[1.05rem]">Sync from Email</h2>
            {error === "email_sync_not_allowed" && (
              // A redirect that landed here because the Gmail allowlist
              // re-check rejected the User (ADR-0009's addendum) deserves an
              // explanation, not a silently-dropped query param. The section
              // below still renders — the User may still have the Outlook
              // option, or an already-connected mailbox.
              <p className="mt-4 text-sm text-destructive" role="alert">
                Your account isn&apos;t on the Gmail sync allowlist yet.{" "}
                <Link
                  href="/contact"
                  className="text-foreground underline underline-offset-2"
                >
                  Request access
                </Link>
                .
              </p>
            )}
            <div className="bb-card mt-4 p-4 sm:p-6">
              <MailboxSyncSection
                mailboxLink={mailboxLink}
                gmailConnectAllowed={gmailConnectAllowed}
                outlookConnectConfigured={outlookConnectConfigured}
                error={error}
                justConnected={justConnected === "1"}
              />
            </div>
          </div>
          <div className="mt-12">
            <h2 className="bb-h text-[1.05rem]">Sign out</h2>
            {/* On its own kraft card like every other section — the quiet
                destructive button washes out sitting straight on the cork. */}
            <div className="bb-card mt-4 flex flex-col items-start gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <p className="text-sm text-muted-foreground">
                You&apos;ll need to sign in again next time.
              </p>
              <SignOutButton />
            </div>
          </div>
          <BbFooter />
        </div>
      </section>
    </div>
  );
}
