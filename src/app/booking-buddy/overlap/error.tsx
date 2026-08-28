"use client";

import { DataError } from "@/components/booking-buddy/data-error";

/**
 * An empty result here would read as "nobody's free", which is exactly the
 * thing a User might act on — so a failed read must not look like one. See
 * `readFailed`.
 */
export default function OverlapError(props: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <DataError
      title="Couldn't work out when you're all free"
      description="Something went wrong reading your and your friends' availability. This isn't you, and nothing has been changed."
      {...props}
    />
  );
}
