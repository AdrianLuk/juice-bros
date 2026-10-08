import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicBoard } from "@/components/team-tally/public-board";
import { loadPublicEvent } from "@/lib/team-tally/live-events";
import { createClient } from "@/lib/team-tally/supabase/server";

export const metadata: Metadata = {
  title: "Live standings · Team Tally",
  description: "Standings and Matchups for tonight's team event.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/**
 * The Public Link (issue #623): read-only standings and every Matchup, kept
 * live. Phone layout; the big-screen layout arrives with #625.
 */
export default async function PublicLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const event = await loadPublicEvent(supabase, token);
  if (!event) notFound();

  return (
    <div className="flex w-full flex-1 flex-col">
      <PublicBoard token={token} initial={{ event }} />
    </div>
  );
}
