import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { pageMetadata } from "@/lib/metadata";
import { createClient } from "@/lib/on-deck/supabase/server";
import { getPublicClubName } from "@/lib/on-deck/clubs";
import { getOpenSessionForClub } from "@/lib/on-deck/sessions";
import { clubQrPath, sessionPath } from "@/lib/on-deck/routes";
import { ArenaShell } from "@/components/on-deck/arena-shell";

/**
 * The Club's name, or null when it cannot be had — an id matching no Club, or
 * a database that is having a bad night. Never a reason to fail the page: the
 * screen below reads perfectly well without it, and somebody standing in a gym
 * would rather be told nothing is running than be shown an error.
 */
async function clubNameFor(clubId: string): Promise<string | null> {
  const supabase = await createClient();
  return getPublicClubName(supabase, clubId).catch(() => null);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ clubId: string }>;
}): Promise<Metadata> {
  const { clubId } = await params;
  const name = await clubNameFor(clubId);

  return {
    ...pageMetadata({
      // Named for the Club, because this link's job is to be pasted into that
      // Club's group chat, where the unfurl is the only thing anyone reads.
      title: name ?? "On Deck",
      description: name
        ? `Join tonight's session at ${name}.`
        : "Join tonight's pickleball social.",
      path: clubQrPath(clubId),
    }),
    // The QR sign is a fixed URL that redirects; nothing here to index.
    robots: { index: false, follow: false },
  };
}

/**
 * The stable per-Club path a printed QR sign points at, and the link an
 * Organizer pastes into their group chat. Resolves to the currently-open
 * Session, or the screen below. Reachable with no account — a Player scanning
 * the sign (ADR 0005) reads as `anon`, which RLS allows for an open Session.
 */
export default async function ClubQrPage({
  params,
}: {
  params: Promise<{ clubId: string }>;
}) {
  const { clubId } = await params;
  const supabase = await createClient();

  const openSession = await getOpenSessionForClub(supabase, clubId).catch(
    () => null,
  );

  if (openSession) {
    redirect(sessionPath(openSession.config.sessionId));
  }

  const name = await getPublicClubName(supabase, clubId).catch(() => null);

  return (
    <ArenaShell className="items-center justify-center px-6 py-24 text-center">
      <div className="od-panel mx-auto max-w-sm px-6 py-8">
        {/*
          Whose page this is, before what it says. A Player gets here by
          scanning their own club's sign or by tapping a link in their own
          club's chat, and either way the name they are looking for is the
          club's. The shell above carries no On Deck wordmark here either
          (issue #518, `isRoomFacingPath`) — the room sees the Club, full stop.
        */}
        <p className="od-readout text-[0.78rem] text-arena-dim">
          {name ?? "On Deck"}
        </p>
        <h1 className="od-display-tight mt-2 text-3xl text-arena-fg">
          Nothing running right now
        </h1>
        {/*
          Says nothing about how they arrived. The old copy told them to scan
          the sign again, which is wrong for anybody who tapped a link, and the
          fact worth giving them either way is that the link keeps working.
        */}
        <p className="mt-3 text-sm text-arena-faint">
          No session is open yet. This link stays the same every week, so hang
          onto it and open it again once play has started.
        </p>
      </div>
    </ArenaShell>
  );
}
