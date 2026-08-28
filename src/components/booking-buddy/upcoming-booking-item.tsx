"use client";

import { BOOKING_FORMAT_LABEL } from "@/lib/booking-buddy/capacity";
import { formatCourtLabel } from "@/lib/booking-buddy/bookings";
import { BookingDetailsModal } from "@/components/booking-buddy/bookings";
import type { Booking } from "@/lib/booking-buddy/actions/bookings";
import type { Org } from "@/lib/booking-buddy/actions/orgs";

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
 * One "Coming up" row on the dashboard sidebar — a client component (the
 * server-rendered `UpcomingBookingsSidebar` around it stays plain) since it's
 * the click target that opens `BookingDetailsModal`, the same details popup
 * the Bookings list's own "View" button opens.
 */
export function UpcomingBookingItem({
  booking,
  orgs,
}: {
  booking: Booking;
  orgs: Org[];
}) {
  return (
    <BookingDetailsModal
      booking={booking}
      orgs={orgs}
      nativeButton={false}
      render={
        <li className="bb-card bb-card-interactive w-full cursor-pointer p-3 text-left" />
      }
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
    </BookingDetailsModal>
  );
}
