import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LiveBoard } from "@/components/apps/match-mixer/live-board";
import { readLiveMixer } from "@/lib/match-mixer/live-mixers";
import { organizerLinkPath, playerLinkPath } from "@/lib/match-mixer/routes";
import { createClient } from "@/lib/match-mixer/supabase/server";

type Props = { params: Promise<{ token: string }> };

export const metadata: Metadata = {
  title: "Organizer · Match Mixer",
  robots: { index: false, follow: false },
};

/**
 * A Live Mixer's Organizer Link (#687): the board, both links to copy, and
 * score entry, the Game Rule and Standings (#688).
 */
export default async function OrganizerLinkPage({ params }: Props) {
  const { token } = await params;
  const mixer = await readLiveMixer(await createClient(), token);
  if (mixer?.role !== "organizer" || !mixer.playerToken) notFound();

  return (
    <div className="flex w-full flex-1 flex-col">
      <LiveBoard
        token={token}
        initial={mixer}
        organizerPath={organizerLinkPath(token)}
        playerPath={playerLinkPath(mixer.playerToken)}
      />
    </div>
  );
}
