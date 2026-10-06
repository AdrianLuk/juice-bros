"use client";

import { DataError } from "@/components/booking-buddy/data-error";

export default function WeeklyInviteAnswerError(props: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <DataError
      title="Couldn't load this game"
      description="Something went wrong reading your weekly game. This isn't you, and nothing has been changed."
      {...props}
    />
  );
}
