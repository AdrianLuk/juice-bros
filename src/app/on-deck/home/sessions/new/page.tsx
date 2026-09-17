import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { pageMetadata } from "@/lib/metadata";
import { verifyOrganizer } from "@/lib/on-deck/dal";
import { createClient } from "@/lib/on-deck/supabase/server";
import { getOwnedClub } from "@/lib/on-deck/clubs";
import { ON_DECK_HOME_PATH, ON_DECK_NEW_SESSION_PATH } from "@/lib/on-deck/routes";
import { SessionForm } from "@/components/on-deck/session-form";
import { ArenaShell } from "@/components/on-deck/arena-shell";
import { BoardHead } from "@/components/on-deck/back-office";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "Schedule an On Deck session",
    description: "Set up a session ahead of time with its own venue or court count.",
    path: ON_DECK_NEW_SESSION_PATH,
  }),
  robots: { index: false, follow: false },
};

/**
 * Create a Session ahead of time (issue #254). The form seeds from the Club
 * defaults; the Organizer changes the date, venue, or court count for one
 * night without touching the defaults themselves.
 */
export default async function OnDeckNewSessionPage() {
  await verifyOrganizer();
  const supabase = await createClient();
  const club = await getOwnedClub(supabase);

  if (!club) {
    redirect(ON_DECK_HOME_PATH);
  }

  return (
    <ArenaShell>
      <section className="w-full flex-1 px-5 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto w-full max-w-xl">
          <BoardHead name="Schedule a night" spec={[club.name]} />

          <SessionForm venueName={club.venueName} courtCount={club.courtCount} />
        </div>
      </section>
    </ArenaShell>
  );
}
