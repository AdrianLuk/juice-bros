import Link from "next/link";

import { BOOKINGS_PATH } from "@/lib/booking-buddy/routes";
import { BOOKING_FORMAT_LABEL } from "@/lib/booking-buddy/capacity";
import { upcomingBookings } from "@/lib/booking-buddy/calendar";
import { formatCourtLabel } from "@/lib/booking-buddy/bookings";
import type { Booking } from "@/lib/booking-buddy/actions/bookings";

const SIDEBAR_LIMIT = 5;

function durationLabel(startsAt: string, endsAt: string): string {
  const minutes = Math.round(
    (new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60_000,
  );
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) {
    return `${remainder} min`;
  }
  return remainder === 0 ? `${hours} hr` : `${hours} hr ${remainder} min`;
}

/**
 * The persistent "what's coming up" list next to the calendar (issue #23) —
 * visible regardless of which calendar view is active, so it's a plain
 * server-rendered list rather than something the calendar client component
 * owns. Past Bookings never appear here; `/booking-buddy/bookings` is still
 * the full past+future history.
 */
export function UpcomingBookingsSidebar({
  bookings,
  now,
}: {
  bookings: Booking[];
  now: Date;
}) {
  const upcoming = upcomingBookings(bookings, now, SIDEBAR_LIMIT);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="font-heading text-sm font-semibold tracking-tight">
          Coming up
        </h2>
        <Link
          href={BOOKINGS_PATH}
          className="text-xs text-muted-foreground underline underline-offset-4 hover:text-primary"
        >
          See all
        </Link>
      </div>

      {upcoming.length === 0 ? (
        <p className="rounded-xl border border-dashed border-muted-foreground/25 bg-muted/30 p-4 text-sm text-muted-foreground">
          Nothing booked yet. Log one to see it here.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {upcoming.map((booking) => (
            <li
              key={booking.id}
              className="bb-card bb-card-interactive p-3"
            >
              <p className="text-sm font-medium">{booking.when}</p>
              {booking.name && (
                <p className="mt-0.5 text-xs font-medium">{booking.name}</p>
              )}
              <p className="mt-0.5 text-xs text-muted-foreground">
                {booking.orgName} · {formatCourtLabel(booking.courtLabel)}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {durationLabel(booking.startsAt, booking.endsAt)} ·{" "}
                {BOOKING_FORMAT_LABEL[booking.format]}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
