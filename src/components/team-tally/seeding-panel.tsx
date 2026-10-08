"use client";

import { useId, useState, useTransition, type FormEvent } from "react";

import { orderTiedTeams, seedFlightsNow, swapFlightCourts } from "@/lib/team-tally/actions/live";
import { isScored, type TeamEventDoc } from "@/lib/team-tally/event-doc";
import { computeStandings, standingsMoved } from "@/lib/team-tally/standings";

type Result = { ok: true } | { ok: false; problem: string };

/**
 * The Organizer's Flights sheet (issue #624). Before Seeding: how many
 * Matchups are done, any tie on every count that straddles a Flight (the
 * Organizer's call), and Seed now, confirmed in the page. After: the
 * opening standings moving since Seeding, and swapping two Flights' court
 * pairs until a Flight has a score.
 */
export function SeedingPanel({ event, onSaved }: { event: TeamEventDoc; onSaved: () => Promise<unknown> }) {
  const [confirming, setConfirming] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<Result>, after?: () => void) {
    setProblem(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setProblem(result.problem);
        return;
      }
      await onSaved();
      after?.();
    });
  }

  const opening = event.matchups.filter((matchup) => matchup.stage === "opening");
  const flights = event.matchups.filter((matchup) => matchup.stage === "flight");
  const done = opening.filter((matchup) => matchup.doneAt !== null).length;
  const standings = computeStandings(event);
  const seeded = flights.length > 0;

  return (
    <section className="tt-sheet" aria-label="The Flights">
      <div className="tt-section-head">
        <h2 className="tt-h2">The Flights</h2>
        <span className="tt-meta">
          {seeded ? "Placed" : `${done} of ${opening.length} Matchups done`}
        </span>
      </div>
      <div className="tt-done-body">
        {seeded ? (
          <>
            {standingsMoved(event) && (
              <p className="tt-callout m-0" role="status">
                The opening standings have moved since the Flights were placed. The Flights stay as they are.
              </p>
            )}
            <SwapCourts event={event} pending={pending} run={run} />
          </>
        ) : (
          <>
            <p className="tt-body">
              The Flights place themselves when the last Matchup is done. Seed now places them from the scores as they
              stand.
            </p>

            {standings.map((row, index) => {
              if (row.decidedBy !== "organizer") return null;
              const above = standings[index - 1];
              const order = standings.map((standing) => standing.teamId);
              [order[index - 1], order[index]] = [order[index], order[index - 1]];
              return (
                <div key={row.teamId} className="tt-callout">
                  <p className="m-0">
                    {above.name} and {row.name} are level on every count, across Flights {above.flightLetter} and{" "}
                    {row.flightLetter}. Your call: {above.name} is ahead for now.
                  </p>
                  <button
                    type="button"
                    className="tt-btn tt-btn-ghost"
                    disabled={pending}
                    onClick={() => run(() => orderTiedTeams(event.id, order))}
                  >
                    Put {row.name} ahead
                  </button>
                </div>
              );
            })}

            {confirming ? (
              <div role="alertdialog" aria-label="Seed the Flights now" className="tt-confirm">
                <p className="m-0">
                  {opening.length - done === 0
                    ? "Place the Flights from the opening standings?"
                    : `${opening.length - done} of ${opening.length} Matchups aren't done, so their scores so far count.`}{" "}
                  Once placed, the Flights stay put.
                </p>
                <div className="tt-confirm-actions">
                  <button
                    type="button"
                    className="tt-btn"
                    disabled={pending}
                    onClick={() => run(() => seedFlightsNow(event.id), () => setConfirming(false))}
                  >
                    {pending ? "Placing" : "Place the Flights"}
                  </button>
                  <button type="button" className="tt-quietlink" onClick={() => setConfirming(false)}>
                    Not yet
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="tt-btn tt-done-btn" onClick={() => setConfirming(true)}>
                Seed now
              </button>
            )}
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

function SwapCourts({
  event,
  pending,
  run,
}: {
  event: TeamEventDoc;
  pending: boolean;
  run: (action: () => Promise<Result>) => void;
}) {
  const id = useId();
  const flights = event.matchups.filter((matchup) => matchup.stage === "flight");
  const [from, setFrom] = useState(flights[0]?.id ?? "");
  const [to, setTo] = useState(flights[1]?.id ?? "");
  const started = flights.some((flight) => flight.games.some(isScored));

  if (flights.length < 2) return null;
  if (started) {
    return <p className="tt-body">A Flight has a score, so the court pairs are set.</p>;
  }

  const name = (flightId: string) => {
    const flight = flights.find((candidate) => candidate.id === flightId)!;
    return `Flight ${flight.flightLetter} · Courts ${flight.courtPair[0]} & ${flight.courtPair[1]}`;
  };

  function submit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (from && to && from !== to) run(() => swapFlightCourts(from, to));
  }

  return (
    <form className="tt-swap" onSubmit={submit} aria-label="Swap court pairs">
      <div className="tt-swap-field">
        <label htmlFor={`${id}-from`} className="tt-label">
          Swap the courts of
        </label>
        <select id={`${id}-from`} className="tt-field" value={from} onChange={(e) => setFrom(e.target.value)}>
          {flights.map((flight) => (
            <option key={flight.id} value={flight.id}>
              {name(flight.id)}
            </option>
          ))}
        </select>
      </div>
      <div className="tt-swap-field">
        <label htmlFor={`${id}-to`} className="tt-label">
          With
        </label>
        <select id={`${id}-to`} className="tt-field" value={to} onChange={(e) => setTo(e.target.value)}>
          {flights.map((flight) => (
            <option key={flight.id} value={flight.id}>
              {name(flight.id)}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" className="tt-btn tt-btn-ghost" disabled={pending || !from || from === to}>
        Swap courts
      </button>
    </form>
  );
}
