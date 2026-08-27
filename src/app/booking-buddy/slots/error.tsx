"use client";

import { DataError } from "@/components/booking-buddy/data-error";

/**
 * A calm empty list here would read as "nobody's proposed anything", which
 * for the friends' section is indistinguishable from a real empty state —
 * see `readFailed`.
 */
export default function SlotsError(props: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <DataError
      title="Couldn't load games"
      description="Something went wrong reading games. This isn't you, and nothing has been changed."
      {...props}
    />
  );
}
