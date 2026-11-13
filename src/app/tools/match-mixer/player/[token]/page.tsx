import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LiveBoard } from "@/components/apps/match-mixer/live-board";
import { readLiveMixer } from "@/lib/match-mixer/live-mixers";
import { playerLinkPath } from "@/lib/match-mixer/routes";
import { createClient } from "@/lib/match-mixer/supabase/server";

type Props = { params: Promise<{ token: string }> };

export const metadata: Metadata = {
  title: "Live board · Match Mixer",
  robots: { index: false, follow: false },
};

/**
 * A Live Mixer's Player Link (#687): the board the organizer drew, with
 * find-me, its scores and Standings kept live (#688), and scoring for a
 * player's own Games (#689). A signed-in superadmin runs the night from here
 * too (#690), with this link the only one it shows.
 */
export default async function PlayerLinkPage({ params }: Props) {
  const { token } = await params;
  const mixer = await readLiveMixer(await createClient(), token);
  if (mixer?.role !== "player") notFound();

  return (
    <div className="flex w-full flex-1 flex-col">
      <LiveBoard token={token} initial={mixer} playerPath={playerLinkPath(token)} />
    </div>
  );
}
