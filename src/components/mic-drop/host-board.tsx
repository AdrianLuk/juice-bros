"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { X } from "lucide-react";

import { removeFromLineUp, setPollOpen } from "@/lib/mic-drop/actions/host";
import { barShare } from "@/lib/mic-drop/leaderboard";
import { MIC_DROP_ROOT } from "@/lib/mic-drop/routes";
import type { GuestPoll } from "@/lib/mic-drop/polls";
import { settleWrite } from "@/lib/mic-drop/settle-write";
import { PollField } from "./poll-field";
import { QueryProvider } from "./query-provider";
import { usePollSync } from "./use-poll-sync";

type Props = {
  pollId: string;
  token: string;
  initial: GuestPoll;
  /** In entry order, from the Host's own read. */
  lineUp: { id: string; name: string }[];
  /** Above the line-up: the Guest Link to copy. */
  share: ReactNode;
  /** Below the line-up: adding a Contestant, the way back. */
  children: ReactNode;
};

/**
 * The Host's Poll (issue #670): its line-up in entry order, each Contestant
 * with their live count and bar, and how many phones are in. Rows never move,
 * so a row stays where the Host's thumb expects it; the ranked chart is the
 * Guest Link's job. While the Poll is open each row can be removed, with a
 * warning first when it has Votes; at the end the Host closes the Poll, or
 * reopens it (issue #671).
 */
export function HostBoard(props: Props) {
  return (
    <QueryProvider>
      <LiveLineUp {...props} />
    </QueryProvider>
  );
}

function LiveLineUp({ pollId, token, initial, lineUp, share, children }: Props) {
  const { poll, reconnecting } = usePollSync(token, initial);

  const votes = new Map(poll.contestants.map((contestant) => [contestant.id, contestant.votes]));
  // One added from another of the Host's screens shows up at the end, where entry order puts it.
  const known = new Set(lineUp.map((contestant) => contestant.id));
  const rows = [...lineUp, ...poll.contestants.filter((contestant) => !known.has(contestant.id))];
  const leaderVotes = poll.contestants[0]?.votes ?? 0;

  return (
    <>
      <PollField poll={poll} reconnecting={reconnecting} liveLabel="Live" finalLabel="Final" />
      <div className="md-host">
        <div className="md-col">
          {share}
          <section aria-labelledby="md-lineup-title">
            <h2 id="md-lineup-title" className="md-label">
              Line-up
            </h2>
            {rows.length === 0 ? (
              <p className="md-empty">No Contestants yet. Type the first singer below.</p>
            ) : (
              <LineUp
                pollId={pollId}
                rows={rows.map((contestant) => ({ ...contestant, votes: votes.get(contestant.id) ?? 0 }))}
                leaderVotes={leaderVotes}
                editable={poll.open}
              />
            )}
          </section>
          {children}
          <ClosePoll pollId={pollId} poll={poll} />
          <Link href={MIC_DROP_ROOT} className="md-quiet">
            All your Polls
          </Link>
        </div>
      </div>
    </>
  );
}

type Row = { id: string; name: string; votes: number };

function LineUp({
  pollId,
  rows,
  leaderVotes,
  editable,
}: {
  pollId: string;
  rows: Row[];
  leaderVotes: number;
  editable: boolean;
}) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function remove(row: Row) {
    setProblem(null);
    startTransition(async () => {
      const outcome = await settleWrite(removeFromLineUp(pollId, row.id));
      if (!outcome.ok) setProblem(outcome.problem);
      setConfirming(null);
    });
  }

  // A Contestant with Votes gets a warning first: removing them wipes those Votes.
  function tapRemove(row: Row) {
    if (row.votes > 0) setConfirming(row.id);
    else remove(row);
  }

  return (
    <>
      <ol className="md-lineup">
        {rows.map((row) => (
          <li key={row.id} className={editable ? "is-editable" : undefined}>
            <span className="md-lineup-name">{row.name}</span>
            <span className="md-count">{row.votes}</span>
            {editable && (
              <button
                type="button"
                className="md-remove"
                aria-label={`Remove ${row.name}`}
                disabled={pending}
                onClick={() => tapRemove(row)}
              >
                <X aria-hidden size={18} />
              </button>
            )}
            <span className="md-bar" aria-hidden>
              <i style={{ transform: `scaleX(${barShare(row.votes, leaderVotes)})` }} />
            </span>
            {confirming === row.id && (
              <div className="md-confirm" role="group" aria-label={`Remove ${row.name}?`}>
                <p>
                  Remove {row.name}? Their {row.votes} {row.votes === 1 ? "vote goes" : "votes go"} too, and those
                  phones can pick again.
                </p>
                <div className="md-form-row">
                  <button type="button" className="md-btn" disabled={pending} onClick={() => remove(row)}>
                    {pending ? "Removing…" : "Remove"}
                  </button>
                  <button type="button" className="md-quiet" onClick={() => setConfirming(null)}>
                    Keep them
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ol>
      <p role="alert" className="md-problem">
        {problem}
      </p>
    </>
  );
}

/** The end of the night: close the Poll after a confirm, or reopen it in one tap. */
function ClosePoll({ pollId, poll }: { pollId: string; poll: GuestPoll }) {
  const [confirming, setConfirming] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function setOpen(open: boolean) {
    setProblem(null);
    startTransition(async () => {
      const outcome = await settleWrite(setPollOpen(pollId, open));
      if (!outcome.ok) setProblem(outcome.problem);
      setConfirming(false);
    });
  }

  const winners = poll.contestants.filter((contestant) => poll.winnerIds.includes(contestant.id));

  return (
    <section className="md-close" aria-labelledby="md-close-title">
      <h2 id="md-close-title" className="md-label">
        {poll.open ? "Last call" : "Voting's closed"}
      </h2>
      {poll.open ? (
        confirming ? (
          <div className="md-confirm" role="group" aria-label="Close the Poll?">
            <p>Close voting? The chart freezes and whoever leads takes No. 1. You can reopen it.</p>
            <div className="md-form-row">
              <button type="button" className="md-btn" disabled={pending} onClick={() => setOpen(false)}>
                {pending ? "Closing…" : "Close the Poll"}
              </button>
              <button type="button" className="md-quiet" onClick={() => setConfirming(false)}>
                Not yet
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="md-btn" onClick={() => setConfirming(true)}>
            Close the Poll
          </button>
        )
      ) : (
        <>
          <p className="md-close-result">
            {winners.length === 0
              ? "No votes, so no No. 1."
              : winners.length === 1
                ? `No. 1: ${winners[0].name}, with ${winners[0].votes} ${winners[0].votes === 1 ? "vote" : "votes"}.`
                : `Joint No. 1: ${winners.map((winner) => winner.name).join(" and ")}, ${winners[0].votes} votes each. Time for a sing-off.`}
          </p>
          <button type="button" className="md-btn" disabled={pending} onClick={() => setOpen(true)}>
            {pending ? "Reopening…" : "Reopen the Poll"}
          </button>
        </>
      )}
      <p role="alert" className="md-problem">
        {problem}
      </p>
    </section>
  );
}
