"use client";

import { useId, useState, useTransition, type FormEvent } from "react";

import { flightMatchups, isScored, openingMatchups, type TeamEventDoc } from "@/lib/team-tally/event-doc";
import type { OrganizerWrites, WriteResult } from "@/lib/team-tally/live-seam";
import { computeStandings, standingsMoved, tieCalls, type TieCall } from "@/lib/team-tally/standings";

type Result = WriteResult;

/**
 * The Organizer's Flights sheet (issue #624). Before Seeding: how many
 * Matchups are done, any tie on every count that straddles a Flight (the
 * Organizer's call), and Seed now, confirmed in the page. After: a tie on
 * every count the night placed across a Flight line by itself (still the
 * Organizer's call until either Flight has a score), the opening standings
 * moving since Seeding, and swapping two Flights' court pairs until a Flight
 * has a score.
 */
export function SeedingPanel({ event, writes }: { event: TeamEventDoc; writes: OrganizerWrites }) {
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
      after?.();
    });
  }

  const opening = openingMatchups(event);
  const flights = flightMatchups(event);
  const done = opening.filter((matchup) => matchup.doneAt !== null).length;
  const seeded = flights.length > 0;

  function putAhead(call: TieCall) {
    if (seeded) {
      run(() => writes.putTeamAhead(call.behindTeamId));
      return;
    }
    const order = computeStandings(event).map((row) => row.teamId);
    const behind = order.indexOf(call.behindTeamId);
    [order[behind - 1], order[behind]] = [order[behind], order[behind - 1]];
    run(() => writes.orderTiedTeams(order));
  }

  const callouts = tieCalls(event).map((call) => (
    <div key={call.behindTeamId} className="tt-callout">
      <p className="m-0">
        {call.aheadName} and {call.behindName} are level on every count, across Flights {call.aheadFlight} and{" "}
        {call.behindFlight}.{" "}
        {seeded
          ? `The Flights placed ${call.aheadName} ahead. Your call until either Flight has a score.`
          : `Your call: ${call.aheadName} is ahead for now.`}
      </p>
      <button type="button" className="tt-btn tt-btn-ghost" disabled={pending} onClick={() => putAhead(call)}>
        Put {call.behindName} ahead
      </button>
    </div>
  ));

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
            {callouts}
            {standingsMoved(event) && (
              <p className="tt-callout m-0" role="status">
                The opening standings have moved since the Flights were placed. The Flights stay as they are.
              </p>
            )}
            <SwapCourts event={event} writes={writes} pending={pending} run={run} />
          </>
        ) : (
          <>
            <p className="tt-body">
              The Flights place themselves when the last Matchup is done. Seed now places them from the scores as they
              stand.
            </p>

            {callouts}

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
                    onClick={() => run(() => writes.seedFlightsNow(), () => setConfirming(false))}
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
  writes,
  pending,
  run,
}: {
  event: TeamEventDoc;
  writes: OrganizerWrites;
  pending: boolean;
  run: (action: () => Promise<Result>) => void;
}) {
  const id = useId();
  const flights = flightMatchups(event);
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
    if (from && to && from !== to) run(() => writes.swapFlightCourts(from, to));
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
