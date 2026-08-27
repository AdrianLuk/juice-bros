"use client";

import { DataError } from "@/components/booking-buddy/data-error";

export default function FriendsError(props: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <DataError
      title="Couldn't load your friends"
      description="Something went wrong reading your connections. This isn't you, and nothing has been lost."
      {...props}
    />
  );
}
