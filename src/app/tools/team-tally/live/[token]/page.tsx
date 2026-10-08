import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PublicBoard } from "@/components/team-tally/public-board";
import type { PublicView } from "@/components/team-tally/tv-stage";
import { loadPublicEvent } from "@/lib/team-tally/live-events";
import { createClient } from "@/lib/team-tally/supabase/server";

export const metadata: Metadata = {
  title: "Live standings · Team Tally",
  description: "Standings, Matchups and results for tonight's team event.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * The Public Link (issues #623, #625): standings, Matchups, Flights and, once
 * the night ends, the results, kept live. It lays itself out for the screen:
 * a big-screen stage on a TV or laptop, a scrolling page on a phone.
 * `?view=tv` or `?view=scroll` forces one; `?screen=` pins a big-screen screen.
 */
export default async function PublicLinkPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { token } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const event = await loadPublicEvent(supabase, token);
  if (!event) notFound();

  const requested = one(query.view);
  const view: PublicView = requested === "tv" || requested === "scroll" ? requested : "auto";

  return (
    <div className="flex w-full flex-1 flex-col">
      <PublicBoard token={token} initial={{ event }} view={view} screen={one(query.screen)} />
    </div>
  );
}
