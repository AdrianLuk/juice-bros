import type { Metadata } from "next";

import { pageMetadata } from "@/lib/metadata";
import { PageHeading } from "@/components/typography/page-heading";
import { BookingBuddyNav } from "@/components/booking-buddy/bb-nav";
import { DashboardCalendar } from "@/components/booking-buddy/dashboard-calendar";
import { UpcomingBookingsSidebar } from "@/components/booking-buddy/upcoming-bookings";
import { verifySession } from "@/lib/booking-buddy/dal";
import { getDashboardPageData } from "@/lib/booking-buddy/actions/dashboard";

export const metadata: Metadata = pageMetadata({
  title: "Booking Buddy",
  description:
    "Plan pickleball with your friends — open a time, see who's in, and keep your court bookings in one place.",
  path: "/booking-buddy",
});

export default async function BookingBuddyPage() {
  // Authoritative check. The proxy already bounced signed-out visitors, but
  // that check is optimistic and must not be relied on alone.
  await verifySession();

  const { orgs, bookings, availabilityWindows } = await getDashboardPageData();

  return (
    <div className="flex w-full flex-1 flex-col">
      <section className="w-full px-4 pt-6 pb-10 sm:px-6 sm:pt-10 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col-reverse gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-x-8 sm:gap-y-4">
            <div>
              <PageHeading
                eyebrow="Booking Buddy"
                title="Dashboard"
                description="Your bookings and open time, at a glance."
              />
            </div>

            <BookingBuddyNav current="dashboard" />
          </div>

          <div className="mt-8 flex flex-col gap-6 lg:flex-row lg:items-start">
            <DashboardCalendar
              bookings={bookings}
              availabilityWindows={availabilityWindows}
              orgs={orgs}
            />
            <UpcomingBookingsSidebar bookings={bookings} now={new Date()} />
          </div>
        </div>
      </section>
    </div>
  );
}
