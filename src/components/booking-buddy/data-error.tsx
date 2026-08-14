"use client";

import { useEffect } from "react";

import { PageHeading } from "@/components/typography/page-heading";
import { Button } from "@/components/ui/button";

/**
 * The body of a Booking Buddy route's error boundary.
 *
 * Exists because the alternative was worse: the reads used to swallow their
 * errors and return empty lists, so an outage — or, once, an entire schema
 * that had never been deployed — rendered as a calm "nothing here yet". Each
 * route supplies its own wording; the shell is the same everywhere.
 */
export function DataError({
  title,
  description,
  error,
  retry,
}: {
  title: string;
  description: string;
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex w-full flex-1 flex-col">
      <section className="w-full px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <PageHeading eyebrow="Booking Buddy" title={title} description={description} />

          <div className="mt-8 flex items-center gap-3">
            <Button type="button" onClick={retry}>
              Try again
            </Button>
          </div>

          {error.digest && (
            <p className="mt-6 text-xs text-muted-foreground">
              Reference: {error.digest}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
