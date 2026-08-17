import type { Metadata } from "next";

import { pageMetadata } from "@/lib/metadata";
import { PageHeading } from "@/components/typography/page-heading";
import { UsernameForm } from "@/components/booking-buddy/username-form";
import {
  BookingWindowPreferenceForm,
  NotificationPreferencesForm,
} from "@/components/booking-buddy/reminders";
import { PushNotificationsForm } from "@/components/booking-buddy/push-notifications";
import { FooterNav, FooterLink } from "@/components/booking-buddy/footer-nav";
import { verifySession } from "@/lib/booking-buddy/dal";
import { getOwnProfile } from "@/lib/booking-buddy/actions/profile";
import { getNotificationPreferences } from "@/lib/booking-buddy/actions/reminders";
import { BOOKING_BUDDY_ROOT } from "@/lib/booking-buddy/routes";

export const metadata: Metadata = pageMetadata({
  title: "Settings",
  description: "Change the username friends use to find you on Booking Buddy.",
  path: "/booking-buddy/settings",
});

export default async function SettingsPage() {
  // Authoritative check. The proxy already bounced signed-out visitors, but
  // that check is optimistic and must not be relied on alone.
  await verifySession();

  const profile = await getOwnProfile();
  const notificationPreferences = await getNotificationPreferences();

  return (
    <div className="flex w-full flex-1 flex-col">
      <section className="w-full px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <PageHeading
            eyebrow="Booking Buddy"
            title="Settings"
            description="Your username was picked for you when you signed up. Change it to whatever you'd rather give out."
          />

          <div className="bb-card mt-10 p-6">
            <UsernameForm username={profile.username} />
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

          <FooterNav>
            <FooterLink href={BOOKING_BUDDY_ROOT} back>
              Back to Booking Buddy
            </FooterLink>
          </FooterNav>
        </div>
      </section>
    </div>
  );
}
