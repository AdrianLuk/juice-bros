"use client";

import { DataError } from "@/components/booking-buddy/data-error";

/**
 * A calm empty list here would read as "you have no bookings", which is the one
 * thing a User might act on — by booking a court they already have.
 */
export default function BookingsError(props: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <DataError
      title="Couldn't load your bookings"
      description="Something went wrong reading your court bookings — this isn't you, and nothing has been changed."
      {...props}
    />
  );
}
