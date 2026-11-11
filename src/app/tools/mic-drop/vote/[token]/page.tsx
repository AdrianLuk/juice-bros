import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { GuestBoard } from "@/components/mic-drop/guest-board";
import { readGuestPoll } from "@/lib/mic-drop/polls";
import { createClient } from "@/lib/mic-drop/supabase/server";

type Props = { params: Promise<{ token: string }> };

/** One read per request, shared by the metadata and the page. */
const pollFor = cache(async (token: string) => readGuestPoll(await createClient(), token));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const poll = await pollFor((await params).token);
  return { title: poll ? `${poll.name} · Mic Drop` : "No such Poll · Mic Drop" };
}

/**
 * A Poll's Guest Link (issue #669): every Contestant on one screen, tap one
 * to vote, tap another to switch. The server renders the chart; the phone's
 * own Vote arrives with the first read in the browser, because the Guest id
 * lives in the browser's storage.
 */
export default async function GuestLinkPage({ params }: Props) {
  const { token } = await params;
  const poll = await pollFor(token);
  if (!poll) notFound();

  return <GuestBoard token={token} initial={poll} />;
}
