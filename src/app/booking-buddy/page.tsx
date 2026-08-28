import type { Metadata } from "next";

import { pageMetadata } from "@/lib/metadata";
import { PageHeading } from "@/components/typography/page-heading";
import { OwnerDashboardCalendar } from "@/components/booking-buddy/owner-dashboard-calendar";
import { UpcomingBookingsSidebar } from "@/components/booking-buddy/upcoming-bookings";
import { DashboardAvailabilitySidebar } from "@/components/booking-buddy/dashboard-availability-sidebar";
import { OnboardingModal } from "@/components/booking-buddy/onboarding-modal";
import { BbFooter } from "@/components/booking-buddy/bb-footer";
import { BookingBuddyLanding } from "@/components/booking-buddy/landing/booking-buddy-landing";
import { getOptionalSession, verifySession } from "@/lib/booking-buddy/dal";
import { getDashboardPageData } from "@/lib/booking-buddy/actions/dashboard";
import { getOwnProfile } from "@/lib/booking-buddy/actions/profile";
import { getOwnInviteUrl } from "@/lib/booking-buddy/actions/invite-links";

export const metadata: Metadata = pageMetadata({
  title: "Booking Buddy: plan pickleball with your friends",
  description:
    "A free tool from the Juice Bros for friend groups: post an open time, see who's in, share availability, and keep your court bookings in one place.",
  path: "/booking-buddy",
});

export default async function BookingBuddyPage() {
  // This root path is public (the proxy no longer gates it): a signed-out
  // visitor gets the marketing page, a signed-in one gets their dashboard.
  const session = await getOptionalSession();
  if (!session) {
    return <BookingBuddyLanding />;
  }

  // Authoritative re-check — with the proxy out of the picture for this path,
  // this is the dashboard's only gate. `getOptionalSession` above is cached,
  // so this is not a second round trip.
  await verifySession();

  // No Suspense skeleton here, unlike the section pages: the dashboard is the
  // hub every other page routes back to, and its full-viewport calendar + two
  // sidebars make for a heavy placeholder that reads as "content got covered"
  // more than "content is loading". A blocked navigation holds the previous
  // (real, rendered) page until the data lands, then the transition plays
  // straight to the real dashboard — less jarring for a page hit this often.
  const { orgs, bookings, availabilityWindows, hasSlot } =
    await getDashboardPageData();
  const now = new Date();
  const hasBooking = bookings.length > 0;

  // Onboarding (issue #103, reshaped in #176) can still open only while the
  // caller has neither a Booking nor a Slot, and its "coordinate" branch is
  // now the one place Gender is surfaced (ADR 0012) — so the profiles round
  // trip that seeds it is paid only under that same condition, not on every
  // later load of the app's most-visited route.
  // The modal only opens under this same condition, so its friend-footer
  // invite link (#175) and the Gender seed are both paid only here, not on
  // every later load of the app's most-visited route.
  const onboardingCanShow = !hasBooking && !hasSlot;
  const gender = onboardingCanShow ? (await getOwnProfile()).gender : null;
  const inviteUrl = onboardingCanShow ? await getOwnInviteUrl() : null;

  return (
    <div className="flex w-full flex-1 flex-col">
      <OnboardingModal
        orgs={orgs}
        gender={gender}
        inviteUrl={inviteUrl}
        hasBooking={hasBooking}
        hasSlot={hasSlot}
      />
      <section className="w-full px-4 pt-6 pb-10 sm:px-6 sm:pt-10 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <PageHeading
            eyebrow="Booking Buddy"
            title="Dashboard"
            description="Your bookings and open time, at a glance."
          />

          <div className="mt-8 flex flex-col gap-6 lg:flex-row lg:items-start">
            <OwnerDashboardCalendar
              bookings={bookings}
              availabilityWindows={availabilityWindows}
              orgs={orgs}
            />
            <aside className="flex w-full shrink-0 flex-col gap-6 lg:w-72">
              <UpcomingBookingsSidebar bookings={bookings} now={now} orgs={orgs} />
              <DashboardAvailabilitySidebar
                windows={availabilityWindows}
                now={now}
              />
            </aside>
          </div>

          <BbFooter />
        </div>
      </section>
    </div>
  );
}
