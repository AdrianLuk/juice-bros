"use client";

import { BOOKING_FORMAT_LABEL } from "@/lib/booking-buddy/capacity";
import { formatCourtLabel } from "@/lib/booking-buddy/bookings";
import { BookingDetailsModal } from "@/components/booking-buddy/bookings";
import type { Booking } from "@/lib/booking-buddy/actions/bookings";
import type { Org } from "@/lib/booking-buddy/actions/orgs";

/**
 * How many calendar days (viewer-local) separate `then` from `now` — 0 is
 * today, 1 tomorrow. A soft "when" cue for the nearest games, not a precise
 * countdown: the row already carries the exact date and time.
 */
function calendarDayOffset(now: Date, then: Date): number {
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const b = new Date(then.getFullYear(), then.getMonth(), then.getDate());
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function imminenceLabel(nowIso: string, startsAt: string): string | null {
  const start = new Date(startsAt);
  const offset = calendarDayOffset(new Date(nowIso), start);
  if (offset === 0) {
    return start.getHours() >= 17 ? "Tonight" : "Today";
  }
  if (offset === 1) {
    return "Tomorrow";
  }
  return null;
}

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
  nowIso,
}: {
  booking: Booking;
  orgs: Org[];
  /** The dashboard's server `now`, for the "Tonight / Tomorrow" cue. */
  nowIso: string;
}) {
  const imminence = imminenceLabel(nowIso, booking.startsAt);

  return (
    <BookingDetailsModal
      booking={booking}
      orgs={orgs}
      nativeButton={false}
      render={
        <li className="bb-card bb-card-interactive w-full cursor-pointer p-3 text-left" />
      }
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium">{booking.when}</p>
        {imminence && (
          <span className="inline-flex shrink-0 items-center rounded-full bg-accent/40 px-2 py-0.5 text-[0.7rem] font-semibold text-accent-foreground">
            {imminence}
          </span>
        )}
      </div>
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
