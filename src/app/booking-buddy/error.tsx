"use client";

import { DataError } from "@/components/booking-buddy/data-error";

/**
 * `getDashboardPageData` (issue #23) can now throw — a calm empty calendar
 * would read as "you have nothing booked", same reasoning as
 * `bookings/error.tsx`.
 */
export default function DashboardError(props: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <DataError
      title="Couldn't load your dashboard"
      description="Something went wrong reading your bookings and availability. This isn't you, and nothing has been changed."
      {...props}
    />
  );
}
