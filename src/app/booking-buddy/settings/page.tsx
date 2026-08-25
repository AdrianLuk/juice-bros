import type { Metadata } from "next";

import { pageMetadata } from "@/lib/metadata";
import { PageHeading } from "@/components/typography/page-heading";
import { BookingBuddyNav } from "@/components/booking-buddy/bb-nav";
import { UsernameForm } from "@/components/booking-buddy/username-form";
import { GenderForm } from "@/components/booking-buddy/gender-form";
import {
  BookingWindowPreferenceForm,
  NotificationPreferencesForm,
} from "@/components/booking-buddy/reminders";
import { PushNotificationsForm } from "@/components/booking-buddy/push-notifications";
import { GmailSyncSection } from "@/components/booking-buddy/email-sync";
import { FooterNav, FooterLink } from "@/components/booking-buddy/footer-nav";
import { verifySession } from "@/lib/booking-buddy/dal";
import { getOwnProfile } from "@/lib/booking-buddy/actions/profile";
import { getNotificationPreferences } from "@/lib/booking-buddy/actions/reminders";
import { getMailboxLink } from "@/lib/booking-buddy/actions/email-sync";
import { isEmailSyncAllowed } from "@/lib/booking-buddy/email-sync-allowlist";
import { readEmailSyncAllowlist } from "@/lib/booking-buddy/env";
import { BOOKING_BUDDY_ROOT, PRIVACY_PATH } from "@/lib/booking-buddy/routes";

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

  const profile = await getOwnProfile();
  const notificationPreferences = await getNotificationPreferences();

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
          <div className="flex flex-col-reverse gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-x-8 sm:gap-y-4">
            <div>
              <PageHeading
                eyebrow="Booking Buddy"
                title="Settings"
                description="Your username was picked for you when you signed up. Change it to whatever you'd rather give out."
              />
            </div>

            <BookingBuddyNav current="settings" />
          </div>

          <div className="bb-card mt-10 p-6">
            <UsernameForm username={profile.username} />
          </div>

          <div className="bb-card mt-8 p-6">
            <GenderForm gender={profile.gender} />
          </div>

          <div className="mt-8">
            <h2 className="font-heading text-lg font-semibold tracking-tight">
              Reminders
            </h2>
            <div className="bb-card mt-4 flex flex-col divide-y divide-border/60 p-6">
              <div className="pb-5">
                <NotificationPreferencesForm preferences={notificationPreferences} />
              </div>
              <div className="py-5">
                <BookingWindowPreferenceForm preferences={notificationPreferences} />
              </div>
              <div className="pt-5">
                <PushNotificationsForm />
              </div>
            </div>
          </div>

          {emailSyncAllowed ? (
            <div className="mt-8">
              <h2 className="font-heading text-lg font-semibold tracking-tight">
                Sync from Email
              </h2>
              <div className="bb-card mt-4 p-6">
                <GmailSyncSection
                  mailboxLink={mailboxLink}
                  error={error}
                  justConnected={justConnected === "1"}
                />
              </div>
            </div>
          ) : (
            error === "email_sync_not_allowed" && (
              // The section itself stays absent (not just hidden) for an
              // unapproved User, per ADR-0009's addendum — but a redirect
              // that landed here specifically because of that check still
              // deserves an explanation, not a silently-dropped query param.
              <p className="mt-8 text-sm text-destructive" role="alert">
                Your account isn&apos;t approved for email sync yet.
              </p>
            )
          )}

          <FooterNav>
            <FooterLink href={PRIVACY_PATH}>Privacy</FooterLink>
            <FooterLink href={BOOKING_BUDDY_ROOT} back>
              Back to Booking Buddy
            </FooterLink>
          </FooterNav>
        </div>
      </section>
    </div>
  );
}
