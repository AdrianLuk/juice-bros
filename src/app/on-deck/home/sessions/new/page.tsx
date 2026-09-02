import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { pageMetadata } from "@/lib/metadata";
import { PageHeading } from "@/components/typography/page-heading";
import { verifyOrganizer } from "@/lib/on-deck/dal";
import { createClient } from "@/lib/on-deck/supabase/server";
import { getOwnedClub } from "@/lib/on-deck/clubs";
import { ON_DECK_HOME_PATH, ON_DECK_NEW_SESSION_PATH } from "@/lib/on-deck/routes";
import { SessionForm } from "@/components/on-deck/session-form";

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
    <div className="flex w-full flex-1 flex-col">
      <section className="w-full px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-lg">
          <PageHeading eyebrow={club.name} title="Schedule a session" />

          <SessionForm venueName={club.venueName} courtCount={club.courtCount} />
        </div>
      </section>
    </div>
  );
}
