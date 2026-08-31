import type { Metadata } from "next";
import Link from "next/link";

import { pageMetadata } from "@/lib/metadata";
import { PageHeading } from "@/components/typography/page-heading";
import { SignOutButton } from "@/components/booking-buddy/sign-out-button";
import { UsernameForm } from "@/components/booking-buddy/username-form";
import { GenderForm } from "@/components/booking-buddy/gender-form";
import {
  BookingWindowPreferenceForm,
  ConnectionRequestPreferenceForm,
  NotificationPreferencesForm,
} from "@/components/booking-buddy/reminders";
import { PushNotificationsForm } from "@/components/booking-buddy/push-notifications";
import { GmailSyncSection } from "@/components/booking-buddy/email-sync";
import { BbFooter } from "@/components/booking-buddy/bb-footer";
import { verifySession } from "@/lib/booking-buddy/dal";
import { getOwnProfile } from "@/lib/booking-buddy/actions/profile";
import { getNotificationPreferences } from "@/lib/booking-buddy/actions/reminders";
import { getMailboxLink } from "@/lib/booking-buddy/actions/email-sync";
import { isEmailSyncAllowed } from "@/lib/booking-buddy/email-sync-allowlist";
import { readEmailSyncAllowlist } from "@/lib/booking-buddy/env";

export const metadata: Metadata = pageMetadata({
  title: "Settings",
  description: "Change the username friends use to find you on Booking Buddy.",
  path: "/booking-buddy/settings",
});

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; gmail_connected?: string }>;
}) {
  // Authoritative check. The proxy already bounced signed-out visitors, but
  // that check is optimistic and must not be relied on alone.
  const session = await verifySession();

  const { error, gmail_connected: justConnected } = await searchParams;

  const [profile, notificationPreferences] = await Promise.all([
    getOwnProfile(),
    getNotificationPreferences(),
  ]);

  // Optimistic half of ADR-0009's addendum: an unapproved User never even
  // gets the section, not just a disabled one. connectGmail (and the OAuth
  // callback) re-check this authoritatively. Reuses the profile/session
  // already fetched above rather than calling isEmailSyncAllowedForCaller,
  // which would fetch them a second time.
  const emailSyncAllowed = isEmailSyncAllowed(profile.username, session.email, readEmailSyncAllowlist());
  const mailboxLink = emailSyncAllowed ? await getMailboxLink() : null;

  return (
    <div className="flex w-full flex-1 flex-col">
      <section className="w-full px-4 pt-6 pb-16 sm:px-6 sm:pt-16 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <PageHeading
            eyebrow="Booking Buddy"
            title="Settings"
            description="Your username was picked for you when you signed up. Change it to whatever you'd rather give out."
          />

          <div className="bb-card mt-10 p-6">
            <UsernameForm username={profile.username} />
          </div>

          <div className="bb-card mt-8 p-6">
            <GenderForm gender={profile.gender} />
          </div>

          <div className="mt-8">
            <h2 className="font-heading text-lg font-semibold tracking-tight">
              Notifications
            </h2>
            <div className="bb-card mt-4 flex flex-col divide-y divide-border/60 p-6">
              <div className="pb-5">
                <NotificationPreferencesForm preferences={notificationPreferences} />
              </div>
              <div className="py-5">
                <BookingWindowPreferenceForm preferences={notificationPreferences} />
              </div>
              <div className="py-5">
                <ConnectionRequestPreferenceForm preferences={notificationPreferences} />
              </div>
              <div className="pt-5">
                <PushNotificationsForm />
              </div>
            </div>
          </div>

          <div className="mt-8">
            <h2 className="font-heading text-lg font-semibold tracking-tight">
              Sync from Email
            </h2>
            {emailSyncAllowed ? (
              <div className="bb-card mt-4 p-6">
                <GmailSyncSection
                  mailboxLink={mailboxLink}
                  error={error}
                  justConnected={justConnected === "1"}
                />
              </div>
            ) : error === "email_sync_not_allowed" ? (
              // The working UI stays absent (not just hidden) for an
              // unapproved User, per ADR-0009's addendum — but a redirect
              // that landed here specifically because of that check still
              // deserves an explanation, not a silently-dropped query param.
              <p className="mt-4 text-sm text-destructive" role="alert">
                Your account isn&apos;t approved for email sync yet.{" "}
                <Link href="/contact" className="text-foreground underline underline-offset-2">
                  Request access
                </Link>
                .
              </p>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                Email sync reads your CourtReserve confirmation emails and pulls
                those bookings in automatically &mdash; it&apos;s invite-only for
                now. Want in?{" "}
                <Link href="/contact" className="text-foreground underline underline-offset-2">
                  Request access
                </Link>
                .
              </p>
            )}
          </div>

          <div className="mt-12 border-t border-border/60 pt-8">
            <h2 className="font-heading text-lg font-semibold tracking-tight">
              Sign out
            </h2>
            <p className="mt-1 mb-4 text-sm text-muted-foreground">
              You&apos;ll need to sign in again next time.
            </p>
            <SignOutButton />
          </div>

          <BbFooter />
        </div>
      </section>
    </div>
  );
}
