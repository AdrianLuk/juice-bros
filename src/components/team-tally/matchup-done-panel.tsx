"use client";

import { useState, useTransition } from "react";

import { captainTeamName, liveRound, teamName, type DocMatchup, type DocTeam } from "@/lib/team-tally/event-doc";
import type { LiveWrites, WriteResult } from "@/lib/team-tally/live-seam";
import { doneProblem, matchupTotals, matchupWinnerId, needsDreambreaker } from "@/lib/team-tally/matchup-done";

/**
 * Matchup done (issue #624), under a Matchup's Rounds once all six Games have
 * a score: the Dreambreaker control when the Team scores are level, then the
 * Matchup done tap, confirmed in the page. Done, it says who marked it and
 * that only the Organizer reopens it; the Organizer gets Reopen.
 */
export function MatchupDonePanel({
  matchup,
  teams,
  writes,
  lastOpening = false,
}: {
  matchup: DocMatchup;
  teams: Map<string, DocTeam>;
  writes: LiveWrites;
  /** The only opening Matchup still open: done places the Flights. */
  lastOpening?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const red = teams.get(matchup.redTeamId)!;
  const blue = teams.get(matchup.blueTeamId)!;
  const organizer = writes.by === "organizer" ? writes : null;
  const flight = matchup.stage === "flight";

  function run(action: () => Promise<WriteResult>, after?: () => void) {
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

  if (matchup.doneAt) {
    const by = matchup.doneByTeamId ? teams.get(matchup.doneByTeamId) : undefined;
    const winner = matchupWinnerId(matchup);
    const champion = flight && winner ? teams.get(winner) : undefined;
    return (
      <section className="tt-sheet tt-done" aria-label="Matchup done" data-done>
        <div className="tt-done-body">
          <p className="tt-done-line">
            <span className="tt-final">Final</span>
            <span>
              {champion ? (
                <>
                  Flight {matchup.flightLetter} champion: <b>{teamName(champion)}</b>.{" "}
                </>
              ) : null}
              Marked done by {by ? captainTeamName(by) : "the organizer"}.
            </span>
          </p>
          {organizer ? (
            <button
              type="button"
              className="tt-btn tt-btn-ghost"
              disabled={pending}
              onClick={() => run(() => organizer.reopenMatchup(matchup.id))}
            >
              {pending ? "Reopening" : "Reopen Matchup"}
            </button>
          ) : (
            <p className="tt-body">Scores are locked. Only the organizer can reopen it.</p>
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

  // Before Round 3 is in, there is nothing to finish.
  if (liveRound(matchup) !== undefined) return null;

  const totals = matchupTotals(matchup);
  const tied = needsDreambreaker(matchup);

  return (
    <section className="tt-sheet tt-done" aria-label="Finish the Matchup">
      <div className="tt-section-head">
        <h3 className="tt-h2 tt-roster-title">{flight ? `Finish Flight ${matchup.flightLetter}` : "Finish the Matchup"}</h3>
        <span className="tt-meta">
          {totals.red}-{totals.blue}
        </span>
      </div>
      <div className="tt-done-body">
        {tied && (
          <fieldset className="tt-dreambreaker">
            <legend className="tt-label">Dreambreaker</legend>
            <p className="tt-body">
              Tied {totals.red}-{totals.blue}. Play the Dreambreaker, then tap who won. Its points don&apos;t count.
            </p>
            <div className="tt-dreambreaker-picks">
              {([red, blue] as const).map((team, index) => {
                const picked = matchup.dreambreakerWinnerId === team.id;
                return (
                  <button
                    key={team.id}
                    type="button"
                    className="tt-btn tt-btn-ghost tt-pick"
                    aria-pressed={picked}
                    disabled={pending}
                    onClick={() => run(() => writes.recordDreambreaker(matchup.id, picked ? null : team.id))}
                  >
                    <span aria-hidden className={`tt-side ${index === 0 ? "tt-side-red" : "tt-side-blue"}`} />
                    {teamName(team)} won
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}

        {confirming ? (
          <div role="alertdialog" aria-label="Mark this Matchup done" className="tt-confirm">
            <p className="m-0">
              Lock these six scores? Only the organizer can reopen the Matchup.
              {lastOpening && " This is the last Matchup, so the Flights go up as soon as you confirm."}
              {flight && " The winner takes Flight " + matchup.flightLetter + "."}
            </p>
            <div className="tt-confirm-actions">
              <button
                type="button"
                className="tt-btn"
                disabled={pending}
                onClick={() => run(() => writes.markMatchupDone(matchup.id), () => setConfirming(false))}
              >
                {pending ? "Locking" : "Yes, it's done"}
              </button>
              <button type="button" className="tt-quietlink" onClick={() => setConfirming(false)}>
                Not yet
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="tt-btn tt-done-btn"
            disabled={pending}
            onClick={() => {
              const reason = doneProblem(matchup);
              setProblem(reason);
              if (!reason) setConfirming(true);
            }}
          >
            Matchup done
          </button>
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
