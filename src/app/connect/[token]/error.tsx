"use client";

import { DataError } from "@/components/booking-buddy/data-error";

export default function ConnectError(props: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <DataError
      title="Couldn't load this request"
      description="Something went wrong reading this friend request — this isn't you, and nothing has been changed."
      {...props}
    />
  );
}
