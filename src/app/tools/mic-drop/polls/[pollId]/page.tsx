import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import {
  AddContestantForm,
  CopyGuestLink,
} from "@/components/mic-drop/host-controls";
// Request infrastructure (a path to an absolute URL on this host), imported as Team Tally does.
import { absoluteAppUrl } from "@/lib/booking-buddy/request-origin";
import { verifyHost } from "@/lib/mic-drop/dal";
import { loadPoll } from "@/lib/mic-drop/polls";
import { MIC_DROP_ROOT, guestLinkPath } from "@/lib/mic-drop/routes";
import { createClient } from "@/lib/mic-drop/supabase/server";

type Props = { params: Promise<{ pollId: string }> };

const pollFor = cache(async (pollId: string) =>
  loadPoll(await createClient(), pollId),
);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await verifyHost();
  const poll = await pollFor((await params).pollId);
  return { title: poll ? `${poll.name} · Mic Drop` : "Mic Drop" };
}

/**
 * One of the Host's Polls (issue #668): its Guest Link to copy into the group
 * chat, and its line-up in entry order, typed in one name at a time.
 */
export default async function HostPollPage({ params }: Props) {
  await verifyHost();
  const poll = await pollFor((await params).pollId);
  if (!poll) notFound();

  const guestLink = await absoluteAppUrl(guestLinkPath(poll.guestToken));
  const count = poll.lineUp.length;

  return (
    <>
      <header className={poll.open ? "md-field" : "md-field is-final"}>
        <div className="md-col">
          <h1>{poll.name}</h1>
          <div className="md-field-meta">
            <span className="md-live">{poll.open ? "Live" : "Final"}</span>
            <span>
              {count} {count === 1 ? "Contestant" : "Contestants"}
            </span>
          </div>
        </div>
      </header>
      <div className="md-host">
        <div className="md-col">
          <CopyGuestLink url={guestLink} />
          <section aria-labelledby="md-lineup-title">
            <h2 id="md-lineup-title" className="md-label">
              Line-up
            </h2>
            {count === 0 ? (
              <p className="md-empty">
                No Contestants yet. Type the first singer below.
              </p>
            ) : (
              <ol className="md-lineup">
                {poll.lineUp.map((contestant) => (
                  <li key={contestant.id}>{contestant.name}</li>
                ))}
              </ol>
            )}
          </section>
          {poll.open && <AddContestantForm pollId={poll.id} />}
          <Link href={MIC_DROP_ROOT} className="md-quiet">
            All your Polls
          </Link>
        </div>
      </div>
    </>
  );
}
