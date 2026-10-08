import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ScoreLinkBoard } from "@/components/team-tally/score-link-board";
import { loadScoreLinkEvent } from "@/lib/team-tally/live-events";
import { createClient } from "@/lib/team-tally/supabase/server";

export const metadata: Metadata = {
  title: "Score link · Team Tally",
  description: "Enter your Matchup's scores.",
  // The token is the credential: never index it.
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/**
 * A Team's Score Link (issue #623): no account, the token in the path is the
 * credential. An unknown token is a plain 404.
 */
export default async function ScoreLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const view = await loadScoreLinkEvent(supabase, token);
  if (!view) notFound();

  return (
    <div className="flex w-full flex-1 flex-col">
      <ScoreLinkBoard token={token} initial={view} />
    </div>
  );
}
