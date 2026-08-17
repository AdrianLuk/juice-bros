import type { Metadata } from "next";
import Link from "next/link";

import { pageMetadata } from "@/lib/metadata";
import { PageHeading } from "@/components/typography/page-heading";
import { Button, buttonVariants } from "@/components/ui/button";
import { DashboardCalendar } from "@/components/booking-buddy/dashboard-calendar";
import { UpcomingBookingsSidebar } from "@/components/booking-buddy/upcoming-bookings";
import { verifySession } from "@/lib/booking-buddy/dal";
import { getDashboardPageData } from "@/lib/booking-buddy/actions/dashboard";
import { signOut } from "@/lib/booking-buddy/actions/auth";
import {
  FRIENDS_PATH,
  GROUPS_PATH,
  ORGS_PATH,
  SETTINGS_PATH,
  SLOTS_PATH,
} from "@/lib/booking-buddy/routes";

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
      <section className="w-full px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
            <PageHeading
              eyebrow="Booking Buddy"
              title="Dashboard"
              description="Your bookings and open time, at a glance."
            />

            <nav className="flex flex-wrap items-center gap-1 pt-1">
              <Link href={SLOTS_PATH} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                Slots
              </Link>
              <Link href={FRIENDS_PATH} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                Friends
              </Link>
              <Link href={GROUPS_PATH} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                Friend groups
              </Link>
              <Link href={ORGS_PATH} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                Where you play
              </Link>
              <Link href={SETTINGS_PATH} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                Settings
              </Link>
              <form action={signOut} className="ml-1">
                <Button type="submit" variant="outline" size="sm">
                  Sign out
                </Button>
              </form>
            </nav>
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
