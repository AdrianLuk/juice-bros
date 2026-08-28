"use client";

import { useEffect, useState } from "react";

import { Eyebrow } from "@/components/typography/eyebrow";

/**
 * The dashboard's heading (issue #23 territory) — a time-of-day greeting in
 * place of a flat "Dashboard" label, over a one-line read of what's actually
 * on the calendar. The primary nav already marks Dashboard as the active
 * section, so the h1 is free to be warmer than a repeat of that word.
 *
 * The greeting word is the browser's local hour, so it's resolved in an
 * effect and rendered as a plain "Hey" until then — same reason
 * `dashboard-calendar.tsx` reads `now` post-mount rather than during render
 * (SSR runs in the server's zone, hydration in the browser's, and the two can
 * disagree across a local hour boundary). The status line underneath comes
 * from props and is identical on the server and client, so it never flashes.
 */
function greetingForHour(hour: number): string {
  if (hour >= 5 && hour < 12) return "Morning";
  if (hour >= 12 && hour < 17) return "Afternoon";
  return "Evening";
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
  const [greeting, setGreeting] = useState("Hey");

  useEffect(() => {
    setGreeting(greetingForHour(new Date().getHours()));
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
    <>
      <Eyebrow>Booking Buddy</Eyebrow>
      <h1 className="mt-3 font-heading text-4xl font-semibold tracking-[-0.02em] sm:text-5xl">
        <span className="inline-block transition-opacity duration-300">
          {greeting}
        </span>
      </h1>
      <p className="mt-3 max-w-xl text-lg text-muted-foreground">{status}</p>
    </>
  );
}
