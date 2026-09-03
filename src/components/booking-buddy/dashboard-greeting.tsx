"use client";

import { useEffect, useState } from "react";

/**
 * The dashboard's heading (issue #23 territory) — a time-of-day greeting in
 * place of a flat "Dashboard" label, over a one-line read of what's actually
 * on the calendar. The primary nav already marks Dashboard as the active
 * section, so the h1 is free to be warmer than a repeat of that word.
 *
 * "Good " is static; only the time-of-day word depends on the browser's local
 * hour, so it's resolved in an effect and rendered as "day" until then — same
 * reason `dashboard-calendar.tsx` reads `now` post-mount rather than during
 * render (SSR runs in the server's zone, hydration in the browser's, and the
 * two can disagree across a local hour boundary). The status line underneath
 * comes from props and is identical on the server and client, so it never
 * flashes.
 */
function timeWordForHour(hour: number): string {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  return "evening";
}

const COUNT_WORD = ["no", "one", "two", "three", "four", "five"] as const;

function courtsThisWeek(count: number): string {
  const word = count < COUNT_WORD.length ? COUNT_WORD[count] : String(count);
  const noun = count === 1 ? "court" : "courts";
  // Capitalize the leading word — it opens the sentence.
  return `${word[0].toUpperCase()}${word.slice(1)} ${noun} booked this week.`;
}

export function DashboardGreeting({
  thisWeekCount,
  nextBookingDate,
  hasAnyBooking,
}: {
  /** Upcoming bookings starting within 7 days of now. */
  thisWeekCount: number;
  /** Date label of the soonest upcoming booking beyond this week, or null. */
  nextBookingDate: string | null;
  /** Whether the caller has ever logged a booking (past ones included). */
  hasAnyBooking: boolean;
}) {
  const [timeWord, setTimeWord] = useState("day");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot read of the client's clock on mount, matching dashboard-calendar.tsx
    setTimeWord(timeWordForHour(new Date().getHours()));
  }, []);

  let status: string;
  if (thisWeekCount > 0) {
    status = courtsThisWeek(thisWeekCount);
  } else if (nextBookingDate) {
    status = `Next court's booked for ${nextBookingDate}.`;
  } else if (hasAnyBooking) {
    status = "Nothing on the calendar. Grab a court and it shows up here.";
  } else {
    status =
      "Nothing here yet. Log a court you've booked, or post a time and see who's in.";
  }

  return (
    <div className="flex flex-col gap-2">
      <h1 className="font-bb-sign text-[2.6rem] leading-[0.95] tracking-[0.01em] text-foreground uppercase sm:text-[3.4rem]">
        Good{" "}
        {/* Keyed so the swap from the "day" placeholder to the real
            time-of-day word fades in (bb-anim-in) rather than snapping. */}
        <span key={timeWord} className="bb-anim-in inline-block">
          {timeWord}
        </span>
      </h1>
      <p className="max-w-xl text-[0.98rem] text-[var(--bb-on-cork-dim)]">
        {status}
      </p>
    </div>
  );
}
