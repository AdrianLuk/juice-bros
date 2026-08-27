"use client";

import { DataError } from "@/components/booking-buddy/data-error";

/**
 * A calm empty list here would read as "you've blocked off nothing", which is
 * the one thing a User might act on — see `readFailed`.
 */
export default function AvailabilityError(props: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <DataError
      title="Couldn't load your open time"
      description="Something went wrong reading the time you've blocked off. This isn't you, and nothing has been changed."
      {...props}
    />
  );
}
