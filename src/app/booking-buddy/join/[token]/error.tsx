"use client";

import { DataError } from "@/components/booking-buddy/data-error";

export default function JoinError(props: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <DataError
      title="Couldn't open this invite"
      description="Something went wrong reading the invite link — this isn't you. Try again in a moment."
      {...props}
    />
  );
}
