import type { Metadata } from "next";
import Link from "next/link";

import { pageMetadata } from "@/lib/metadata";
import { PageHeading } from "@/components/typography/page-heading";
import {
  BookingRow,
  CreateBookingForm,
} from "@/components/booking-buddy/bookings";
import { verifySession } from "@/lib/booking-buddy/dal";
import { getBookingsPageData } from "@/lib/booking-buddy/actions/bookings";
import { BOOKING_BUDDY_ROOT, ORGS_PATH } from "@/lib/booking-buddy/routes";

export const metadata: Metadata = pageMetadata({
  title: "Your bookings",
  description:
    "Log the court reservations you've made, so your friends can be invited to them later.",
  path: "/booking-buddy/bookings",
});

export default async function BookingsPage() {
  // Authoritative check. The proxy already bounced signed-out visitors, but
  // that check is optimistic and must not be relied on alone.
  await verifySession();

  const { orgs, bookings } = await getBookingsPageData();

  // Resolved here rather than in the client component so both renders agree on
  // the same list — Node's ICU and the browser's are free to disagree about
  // which zones exist, and that would be a hydration mismatch.
  const zones = Intl.supportedValuesOf("timeZone");

  return (
    <div className="flex w-full flex-1 flex-col">
      <section className="w-full px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <PageHeading
            eyebrow="Booking Buddy"
            title="Your bookings"
            description="Court reservations you've already made, typed in here so they're ready to share."
          />

          {orgs.length === 0 ? (
            <p className="mt-10 text-sm text-muted-foreground">
              Bookings need somewhere to be.{" "}
              <Link href={ORGS_PATH} className="underline underline-offset-4">
                Add the place you play
              </Link>
              , then come back.
            </p>
          ) : (
            <div className="mt-10 flex flex-col gap-12">
              <section>
                <h2 className="font-heading text-lg font-semibold tracking-tight">
                  Log a booking
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Copy it off the facility&apos;s own booking screen — Booking
                  Buddy doesn&apos;t reserve courts, it remembers the ones you
                  reserved.
                </p>
                <div className="mt-4">
                  <CreateBookingForm orgs={orgs} zones={zones} />
                </div>
              </section>

              <section>
                <h2 className="font-heading text-lg font-semibold tracking-tight">
                  Booked
                  {bookings.length > 0 && (
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      {bookings.length}
                    </span>
                  )}
                </h2>

                {bookings.length === 0 ? (
                  <p className="mt-4 text-sm text-muted-foreground">
                    Nothing logged yet.
                  </p>
                ) : (
                  <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
                    {bookings.map((booking) => (
                      <BookingRow key={booking.id} booking={booking} />
                    ))}
                  </ul>
                )}
              </section>
            </div>
          )}

          <p className="mt-14 flex gap-4 text-sm">
            <Link href={ORGS_PATH} className="underline underline-offset-4">
              Where you play
            </Link>
            <Link
              href={BOOKING_BUDDY_ROOT}
              className="underline underline-offset-4"
            >
              Back to Booking Buddy
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
