"use client";

import { DataError } from "@/components/booking-buddy/data-error";

/**
 * An empty list on a failed read would claim the User has nowhere they play —
 * and then invite them to add a place they already added. The reads throw for
 * exactly this reason.
 */
export default function OrgsError(props: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <DataError
      title="Couldn't load your places"
      description="Something went wrong reading the places you play — this isn't you, and nothing has been changed."
      {...props}
    />
  );
}
