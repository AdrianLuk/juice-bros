"use client";

import { DataError } from "@/components/booking-buddy/data-error";

export default function SettingsError(props: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <DataError
      title="Couldn't load your settings"
      description="Something went wrong reading your profile. This isn't you, and nothing has been changed."
      {...props}
    />
  );
}
