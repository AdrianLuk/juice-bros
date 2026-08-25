"use client";

import {
  CalendarEventPopover,
  AGENDA_EVENT_CLASS,
  MONTH_EVENT_CLASS,
  WEEK_EVENT_CLASS,
} from "@/components/booking-buddy/calendar-event-popover";
import { DashboardCalendar } from "@/components/booking-buddy/dashboard-calendar";
import {
  eventChipLineBudget,
  type EventRange,
} from "@/components/booking-buddy/dashboard-week-view";
import { formatTimeLabelFromMs } from "@/lib/booking-buddy/datetime";
import type { FriendVisibleBooking } from "@/lib/booking-buddy/actions/friend-calendar";
import type { AvailabilityWindow } from "@/lib/booking-buddy/availability";

const DATE_LABEL = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

/**
 * The popover's date/time line reads in the *viewer's* browser-local clock,
 * not the facility's — unlike the owner's own popover (`formatInstantDateAndTime`
 * with the Booking's own `timeZone`), which exists so the owner sees the
 * exact time to show up on the facility's clock. `friend_visible_bookings`
 * (the database view) deliberately doesn't carry `time_zone` at all — it's
 * not in the ticket's own column list, and the calendar grid itself already
 * positions every block in the viewer's local time (`calendar.ts`'s own
 * long-standing decision). A friend just checking whether someone's busy
 * cares about "what does this mean on my own clock," which local time
 * already answers consistently with where the block sits on the grid; the
 * facility's own clock is what the *owner* needs to actually show up, which
 * isn't this viewer's problem.
 */
function FriendBookingDetails({ booking }: { booking: FriendVisibleBooking }) {
  const startMs = new Date(booking.startsAt).getTime();
  const endMs = new Date(booking.endsAt).getTime();

  return (
    <div className="flex flex-col gap-2">
      <p className="font-heading text-sm font-semibold">
        Booked at {booking.facilityName}
      </p>
      <p className="text-xs text-muted-foreground">
        {DATE_LABEL.format(startMs)} · {formatTimeLabelFromMs(startMs)} –{" "}
        {formatTimeLabelFromMs(endMs)}
      </p>
    </div>
  );
}

/**
 * A friend's read-only calendar (issue #61) — the same Month/Week/Agenda
 * shell the owner's own dashboard uses (`DashboardCalendar`), pointed at a
 * Connection's resolved busy time instead. No `quickActions` (nothing to
 * create here) and `restrictToFuture` set, so navigation can't reach the
 * friend's past and their past busy/open time is filtered out of what
 * renders — the two things that make this view read-only and
 * forward-looking, per the ticket's own acceptance criteria.
 *
 * A booking's popover is stripped to "Booked at [Facility]" plus the
 * start/end time — no court label, no player/response/capacity info, since
 * `FriendVisibleBooking` (`friend_visible_bookings`, the database view)
 * never carries any of that in the first place.
 */
export function FriendDashboardCalendar({
  bookings,
  availabilityWindows,
}: {
  bookings: FriendVisibleBooking[];
  availabilityWindows: AvailabilityWindow[];
}) {
  return (
    <DashboardCalendar
      events={bookings}
      availabilityWindows={availabilityWindows}
      restrictToFuture
      agendaEmptyMessage="Nothing on the calendar yet."
      renderWeekEvent={(booking, style, { startMs, endMs }: EventRange) => {
        // See `eventChipLineBudget` — a short chip clips its second line
        // under `overflow-hidden` rather than shrinking to fit it.
        const lines = eventChipLineBudget(Number(style.height) || 0);

        return (
          <CalendarEventPopover
            key={booking.id}
            event={booking}
            className={WEEK_EVENT_CLASS}
            style={style}
            renderDetails={(b) => <FriendBookingDetails booking={b} />}
          >
            <p className="truncate font-medium">{booking.facilityName}</p>
            {lines >= 2 && (
              <p className="truncate opacity-90">
                {formatTimeLabelFromMs(startMs)} – {formatTimeLabelFromMs(endMs)}
              </p>
            )}
          </CalendarEventPopover>
        );
      }}
      renderMonthEvent={(booking) => (
        <CalendarEventPopover
          key={booking.id}
          event={booking}
          className={MONTH_EVENT_CLASS}
          renderDetails={(b) => <FriendBookingDetails booking={b} />}
        >
          <p className="truncate">{booking.facilityName}</p>
          <p className="truncate opacity-90">
            {formatTimeLabelFromMs(new Date(booking.startsAt).getTime())} –{" "}
            {formatTimeLabelFromMs(new Date(booking.endsAt).getTime())}
          </p>
        </CalendarEventPopover>
      )}
      renderAgendaEvent={(booking) => (
        <CalendarEventPopover
          key={booking.id}
          event={booking}
          className={AGENDA_EVENT_CLASS}
          renderDetails={(b) => <FriendBookingDetails booking={b} />}
        >
          <span className="font-medium">
            {formatTimeLabelFromMs(new Date(booking.startsAt).getTime())}
          </span>
          <span className="min-w-0 flex-1 truncate text-muted-foreground">
            {booking.facilityName}
          </span>
        </CalendarEventPopover>
      )}
    />
  );
}
