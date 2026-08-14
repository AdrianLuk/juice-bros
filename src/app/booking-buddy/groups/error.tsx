"use client";

import { DataError } from "@/components/booking-buddy/data-error";

/**
 * Rendering an empty groups page on a failed read would claim nobody can see
 * the User's calendar — a worse lie than an error, which is why the reads
 * throw rather than returning empty.
 */
export default function GroupsError(props: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <DataError
      title="Couldn't load your groups"
      description="Something went wrong reading your friend groups — this isn't you, and nothing has been changed."
      {...props}
    />
  );
}
