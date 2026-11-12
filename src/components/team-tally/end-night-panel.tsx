"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { flightMatchups, type DocMatchup, type TeamEventDoc } from "@/lib/team-tally/event-doc";
import type { OrganizerWrites, WriteResult } from "@/lib/team-tally/live-seam";
import { doneProblem } from "@/lib/team-tally/matchup-done";

/** "Flight A", "Flights A and B", "Flights A, B and C". */
function flightNames(flights: DocMatchup[]): string {
  const letters = flights.map((flight) => flight.flightLetter);
  if (letters.length === 1) return `Flight ${letters[0]}`;
  return `Flights ${letters.slice(0, -1).join(", ")} and ${letters[letters.length - 1]}`;
}

/**
 * End the night and Resume the night (issue #684). While a night is in its
 * Flights, the Organizer can end it without every Flight played out: each open
 * Flight that could be marked done is, and the rest keep their scores and leave
 * their places blank. Once ended with a Flight still open, Resume the night
 * puts it back in its Flights.
 *
 * Not on the demo night: its adapter has neither write, so nothing shows.
 */
export function EndNightPanel({ event, writes }: { event: TeamEventDoc; writes: OrganizerWrites }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const { endNight, resumeNight } = writes;
  if (!endNight || !resumeNight || event.status === "opening") return null;

  const open = flightMatchups(event)
    .filter((flight) => flight.doneAt === null)
    .sort((a, b) => a.number - b.number);
  if (open.length === 0) return null;

  const ready = open.filter((flight) => doneProblem(flight) === null);
  const blank = open.filter((flight) => doneProblem(flight) !== null);

  function run(action: () => Promise<WriteResult>) {
    setProblem(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setProblem(result.problem);
        return;
      }
      setConfirming(false);
      // The page's header and its results link come from the server render.
      router.refresh();
    });
  }

  const ended = event.status === "finished";

  return (
    <section className="tt-sheet" aria-label={ended ? "Resume the night" : "End the night"}>
      <div className="tt-section-head">
        <h2 className="tt-h2">{ended ? "The night has ended" : "End the night"}</h2>
        <span className="tt-meta">{open.length === 1 ? "1 Flight open" : `${open.length} Flights open`}</span>
      </div>
      <div className="tt-done-body">
        {ended ? (
          <>
            <p className="tt-body">
              {flightNames(open)} {open.length === 1 ? "was" : "were"} not played out, so{" "}
              {open.length === 1 ? "its places are" : "their places are"} blank in the results. Their scores are kept.
            </p>
            <button type="button" className="tt-btn tt-done-btn" disabled={pending} onClick={() => run(resumeNight)}>
              {pending ? "Resuming" : "Resume the night"}
            </button>
          </>
        ) : confirming ? (
          <div role="alertdialog" aria-label="End the night" className="tt-confirm">
            <p className="m-0">
              {ready.length > 0 && `${flightNames(ready)} will be marked done. `}
              {blank.length > 0 &&
                `${flightNames(blank)} can't be, so ${blank.length === 1 ? "its places stay" : "their places stay"} blank. `}
              Every score is locked, and you can resume the night afterwards.
            </p>
            <div className="tt-confirm-actions">
              <button type="button" className="tt-btn" disabled={pending} onClick={() => run(endNight)}>
                {pending ? "Ending" : "End it"}
              </button>
              <button type="button" className="tt-quietlink" onClick={() => setConfirming(false)}>
                Not yet
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="tt-body">
              Done for the night with {flightNames(open)} still open? Ending it puts the results up.
            </p>
            <button type="button" className="tt-btn tt-btn-ghost tt-done-btn" onClick={() => setConfirming(true)}>
              End the night
            </button>
          </>
        )}
        {problem && (
          <p className="tt-flag-note m-0" role="alert">
            {problem}
          </p>
        )}
      </div>
    </section>
  );
}
