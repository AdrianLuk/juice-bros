import Link from "next/link";

import { BOOKINGS_PATH } from "@/lib/booking-buddy/routes";
import { upcomingBookings } from "@/lib/booking-buddy/calendar";
import { UpcomingBookingItem } from "@/components/booking-buddy/upcoming-booking-item";
import type { Booking } from "@/lib/booking-buddy/actions/bookings";
import type { Org } from "@/lib/booking-buddy/actions/orgs";

const SIDEBAR_LIMIT = 5;

/**
 * The persistent "what's coming up" list next to the calendar (issue #23) —
 * visible regardless of which calendar view is active, so it's a plain
 * server-rendered list rather than something the calendar client component
 * owns. Past Bookings never appear here; `/booking-buddy/bookings` keeps the
 * full past+future history too, with past ones tucked behind a collapsed
 * "History" accordion.
 */
export function UpcomingBookingsSidebar({
  bookings,
  now,
  orgs,
}: {
  bookings: Booking[];
  now: Date;
  orgs: Org[];
}) {
  const upcoming = upcomingBookings(bookings, now, SIDEBAR_LIMIT);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="font-bb-sign text-[0.82rem] tracking-[0.1em] text-foreground uppercase">
          Upcoming courts
        </h2>
        <Link
          href={BOOKINGS_PATH}
          className="text-xs text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-brand-orange"
        >
          See all
        </Link>
      </div>

      {upcoming.length === 0 ? (
        <p className="bb-outline p-4 text-sm text-muted-foreground">
          Nothing booked yet.{" "}
          <Link
            href={BOOKINGS_PATH}
            className="underline underline-offset-4 hover:text-primary"
          >
            Log a court reservation
          </Link>{" "}
          to see it here.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {upcoming.map((booking) => (
            <UpcomingBookingItem
              key={booking.id}
              booking={booking}
              orgs={orgs}
              nowIso={now.toISOString()}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
