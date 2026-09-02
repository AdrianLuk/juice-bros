"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { startSession } from "@/lib/on-deck/actions/sessions";
import {
  ON_DECK_NEW_SESSION_PATH,
  editSessionPath,
} from "@/lib/on-deck/routes";
import type { ScheduledSession } from "@/lib/on-deck/sessions";

/** `YYYY-MM-DD` → "Sat, Mar 14" (dates carry no time; read them as UTC). */
function formatSessionDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * The "no session running yet" half of the Organizer home screen (issue #254):
 * one-tap Start plus the list of Sessions set up ahead of time.
 *
 * A client component for one reason — "which scheduled Session does Start
 * open?" is judged against the Organizer's *local* calendar date (that is what
 * `startSession` sends the RPC), which the server render can't know. The badge
 * and Start-card copy here therefore always agree with what the button does.
 */
export function TonightControls({
  scheduledSessions,
}: {
  scheduledSessions: ScheduledSession[];
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // The Organizer's local calendar date (`sv-SE` renders `YYYY-MM-DD`). Read
  // through `useSyncExternalStore` so SSR and the first client render agree on
  // "" (no session flagged), then the real local date takes over on the client
  // — no hydration mismatch, and it always matches what `startSession` sends.
  const today = useSyncExternalStore(
    () => () => {},
    () => new Date().toLocaleDateString("sv-SE"),
    () => "",
  );
  const dueSession = today
    ? scheduledSessions.find((s) => s.scheduledFor === today)
    : undefined;

  function onStart() {
    setError(null);
    start(async () => {
      try {
        await startSession({
          today: today || new Date().toLocaleDateString("sv-SE"),
        });
      } catch (cause) {
        // `redirect()` throws a control-flow signal — re-throw so it navigates.
        if (
          cause &&
          typeof cause === "object" &&
          "digest" in cause &&
          typeof (cause as { digest?: unknown }).digest === "string" &&
          (cause as { digest: string }).digest.startsWith("NEXT_REDIRECT")
        ) {
          throw cause;
        }
        setError("Couldn't start the session just now. Try again.");
      }
    });
  }

  return (
    <>
      <div className="rounded-2xl border bg-card p-6">
        <p className="text-sm text-muted-foreground">
          {dueSession ? (
            <>
              Start opens the session you set up for{" "}
              <span className="text-foreground">
                {formatSessionDate(dueSession.scheduledFor)}
              </span>
              : {dueSession.venueName}, {dueSession.courtCount} courts.
            </>
          ) : (
            <>
              Opens a session from the defaults above. You can rename courts and
              adjust things once it&apos;s running.
            </>
          )}
        </p>
        <Button
          type="button"
          size="lg"
          className="mt-4 h-11 px-6 text-base"
          disabled={pending}
          onClick={onStart}
        >
          {pending ? "Starting…" : "Start"}
        </Button>
        {error && (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>

      <div className="rounded-2xl border bg-card p-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-heading text-lg font-semibold">
            Scheduled sessions
          </h2>
          <Link
            href={ON_DECK_NEW_SESSION_PATH}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Schedule a session
          </Link>
        </div>

        {scheduledSessions.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Nothing scheduled. Set one up ahead of time to give a night its own
            venue or court count.
          </p>
        ) : (
          <ul className="mt-4 divide-y" data-testid="scheduled-sessions">
            {scheduledSessions.map((session) => (
              <li
                key={session.id}
                className="flex items-center justify-between gap-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {formatSessionDate(session.scheduledFor)}
                    {dueSession?.id === session.id && (
                      <span className="ml-2 rounded-full bg-brand-orange/10 px-2 py-0.5 text-xs font-medium text-brand-orange">
                        Start opens this
                      </span>
                    )}
                  </p>
                  <p className="text-muted-foreground">
                    {session.venueName}, {session.courtCount} courts
                  </p>
                </div>
                <Link
                  href={editSessionPath(session.id)}
                  className="underline underline-offset-4"
                >
                  Edit
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
