"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";

import { startSession } from "@/lib/on-deck/actions/sessions";
import { ON_DECK_NEW_SESSION_PATH, editSessionPath } from "@/lib/on-deck/routes";
import type { ScheduledSession } from "@/lib/on-deck/sessions";
import { HANDOFF_KEY, Row, Stage } from "@/components/on-deck/back-office";

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
 * The Organizer's *local* calendar date (`sv-SE` renders `YYYY-MM-DD`).
 *
 * Read through `useSyncExternalStore` so SSR and the first client render agree
 * on "" (no night flagged), then the real local date takes over on the client.
 * No hydration mismatch, and it always matches what `startSession` sends the
 * RPC — which is the whole reason these two pieces are client components.
 */
function useLocalDate(): string {
  return useSyncExternalStore(
    () => () => {},
    () => new Date().toLocaleDateString("sv-SE"),
    () => "",
  );
}

function dueToday(sessions: ScheduledSession[], today: string) {
  return today ? sessions.find((s) => s.scheduledFor === today) : undefined;
}

/**
 * The "nothing running yet" state of the lit panel (issue #254; recomposed for
 * the back office redesign, issue #515).
 *
 * The panel says what Start will open and carries the key that opens it, and
 * nothing on the screen competes with it.
 */
export function TonightControls({
  scheduledSessions,
}: {
  scheduledSessions: ScheduledSession[];
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const today = useLocalDate();
  const dueSession = dueToday(scheduledSessions, today);

  // Arriving straight from the create form, this key is what replaced the
  // button that was just pressed. Take the focus it left behind.
  const startRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    try {
      if (sessionStorage.getItem(HANDOFF_KEY) === null) return;
      sessionStorage.removeItem(HANDOFF_KEY);
    } catch {
      return;
    }
    startRef.current?.focus();
  }, []);

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
    <Stage>
      <p className="od-bo-note">
        {dueSession ? (
          <>
            Start opens the night you set up for{" "}
            <strong>{formatSessionDate(dueSession.scheduledFor)}</strong>:{" "}
            {dueSession.venueName}, {dueSession.courtCount} courts.
          </>
        ) : (
          <>
            Start opens a session from your saved defaults. You can rename courts
            and change the group cap once it is running.
          </>
        )}
      </p>

      {error && (
        <p className="text-sm font-medium text-arena-warn" role="alert">
          {error}
        </p>
      )}

      <button
        ref={startRef}
        type="button"
        className="od-key od-key--go od-key--turnover"
        disabled={pending}
        onClick={onStart}
      >
        {pending ? "Starting…" : "Start tonight"}
      </button>
    </Stage>
  );
}

/**
 * Nights set up ahead of time, as rows under the panel.
 *
 * These used to be a second card of equal weight beside Start. A night three
 * weeks out is not what the Organizer opened this screen to do, so it reads as
 * a row — except the one Start is about to open, which carries the tag saying
 * so. That tag is why this is a client component: "due today" is judged on the
 * Organizer's own clock, not the server's.
 */
export function ScheduledRows({
  scheduledSessions,
}: {
  scheduledSessions: ScheduledSession[];
}) {
  const dueSession = dueToday(scheduledSessions, useLocalDate());

  return (
    <>
      {scheduledSessions.length > 0 && (
        <div data-testid="scheduled-sessions" className="contents">
          {scheduledSessions.map((session) => (
            <Row
              key={session.id}
              href={editSessionPath(session.id)}
              label={formatSessionDate(session.scheduledFor)}
              sub={`${session.venueName}, ${session.courtCount} courts`}
              tag={
                dueSession?.id === session.id ? "Start opens this" : undefined
              }
            />
          ))}
        </div>
      )}
      <Row
        href={ON_DECK_NEW_SESSION_PATH}
        label="Schedule a night"
        value={
          scheduledSessions.length > 0
            ? `${scheduledSessions.length} set up`
            : undefined
        }
      />
    </>
  );
}
