import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import { HostBoard } from "@/components/mic-drop/host-board";
import {
  AddContestantForm,
  CopyGuestLink,
} from "@/components/mic-drop/host-controls";
// Request infrastructure (a path to an absolute URL on this host), imported as Team Tally does.
import { absoluteAppUrl } from "@/lib/booking-buddy/request-origin";
import { verifyHost } from "@/lib/mic-drop/dal";
import { loadPoll, readGuestPoll } from "@/lib/mic-drop/polls";
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
 * chat, and its line-up in entry order, typed in one name at a time. Counts
 * come live through the Guest Link's own read (issue #670).
 */
export default async function HostPollPage({ params }: Props) {
  await verifyHost();
  const poll = await pollFor((await params).pollId);
  if (!poll) notFound();

  const [guestLink, initial] = await Promise.all([
    absoluteAppUrl(guestLinkPath(poll.guestToken)),
    readGuestPoll(await createClient(), poll.guestToken),
  ]);
  if (!initial) notFound();

  return (
    <HostBoard
      pollId={poll.id}
      token={poll.guestToken}
      initial={initial}
      lineUp={poll.lineUp}
      share={<CopyGuestLink url={guestLink} />}
    >
      {poll.open && <AddContestantForm pollId={poll.id} />}
      <Link href={MIC_DROP_ROOT} className="md-quiet">
        All your Polls
      </Link>
    </HostBoard>
  );
}
