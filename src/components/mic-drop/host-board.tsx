"use client";

import type { ReactNode } from "react";

import { barShare } from "@/lib/mic-drop/leaderboard";
import type { GuestPoll } from "@/lib/mic-drop/polls";
import { cn } from "@/lib/utils";
import { QueryProvider } from "./query-provider";
import { usePollSync } from "./use-poll-sync";

type Props = {
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
 * Guest Link's job.
 */
export function HostBoard(props: Props) {
  return (
    <QueryProvider>
      <LiveLineUp {...props} />
    </QueryProvider>
  );
}

function LiveLineUp({ token, initial, lineUp, share, children }: Props) {
  const { poll, reconnecting } = usePollSync(token, initial);

  const votes = new Map(poll.contestants.map((contestant) => [contestant.id, contestant.votes]));
  // One added from another of the Host's screens shows up at the end, where entry order puts it.
  const known = new Set(lineUp.map((contestant) => contestant.id));
  const rows = [...lineUp, ...poll.contestants.filter((contestant) => !known.has(contestant.id))];
  const leaderVotes = poll.contestants[0]?.votes ?? 0;

  return (
    <>
      <header className={cn("md-field", !poll.open && "is-final")}>
        <div className="md-col">
          <h1>{poll.name}</h1>
          <div className="md-field-meta">
            <span role="status" className={cn("md-live", reconnecting && "is-stale")}>
              {reconnecting ? "Reconnecting…" : poll.open ? "Live" : "Final"}
            </span>
            <span>
              {poll.phonesIn} {poll.phonesIn === 1 ? "phone" : "phones"} in
            </span>
          </div>
        </div>
      </header>
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
              <ol className="md-lineup">
                {rows.map((contestant) => {
                  const count = votes.get(contestant.id) ?? 0;
                  return (
                    <li key={contestant.id}>
                      <span className="md-lineup-name">{contestant.name}</span>
                      <span className="md-count">{count}</span>
                      <span className="md-bar" aria-hidden>
                        <i style={{ transform: `scaleX(${barShare(count, leaderVotes)})` }} />
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
          {children}
        </div>
      </div>
    </>
  );
}
