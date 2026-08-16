"use client";

import { DataError } from "@/components/booking-buddy/data-error";

export default function GuestSlotError(props: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <DataError
      title="Couldn't load this invite"
      description="Something went wrong reading this slot — this isn't you, and nothing has been changed."
      {...props}
    />
  );
}
