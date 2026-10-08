"use client";

import { useState, useTransition } from "react";

import { deleteTeamEventAction } from "@/lib/team-tally/actions/events";

/**
 * Delete a Team Event (issue #625), for the Organizer, at the foot of its
 * page. Final, so it asks first, in the page: a confirm box that says what
 * goes with it, never `confirm()`. On success the action sends the Organizer
 * back to their list.
 */
export function DeleteEventPanel({ eventId, name }: { eventId: string; name: string }) {
  const [confirming, setConfirming] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function remove() {
    setProblem(null);
    startTransition(async () => {
      // On success the action redirects, so a return value is always a refusal.
      const result = await deleteTeamEventAction(eventId);
      setProblem(result.problem);
    });
  }

  return (
    <section aria-label="Delete this Team Event" className="tt-delete">
      {confirming ? (
        <div role="alertdialog" aria-label="Delete this Team Event for good" className="tt-confirm">
          <p className="m-0">
            Delete <b>{name}</b> for good? Its scores, results and every Score Link and the Public Link go with it. This
            can&apos;t be undone.
          </p>
          <div className="tt-confirm-actions">
            <button type="button" className="tt-btn" disabled={pending} onClick={remove}>
              {pending ? "Deleting" : "Yes, delete it"}
            </button>
            <button type="button" className="tt-quietlink" disabled={pending} onClick={() => setConfirming(false)}>
              Keep it
            </button>
          </div>
          {problem && (
            <p className="tt-flag-note m-0" role="alert">
              {problem}
            </p>
          )}
        </div>
      ) : (
        <button type="button" className="tt-btn tt-btn-ghost" onClick={() => setConfirming(true)}>
          Delete Team Event
        </button>
      )}
    </section>
  );
}
