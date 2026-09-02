import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { pageMetadata } from "@/lib/metadata";
import { PageHeading } from "@/components/typography/page-heading";
import { verifyOrganizer } from "@/lib/on-deck/dal";
import { createClient } from "@/lib/on-deck/supabase/server";
import { getOwnedClub } from "@/lib/on-deck/clubs";
import { FLOOR_MODE_LABEL } from "@/lib/on-deck/session/types";
import { ON_DECK_HOME_PATH, ON_DECK_SETTINGS_PATH } from "@/lib/on-deck/routes";
import { ClubDefaultsForm } from "@/components/on-deck/club-defaults-form";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "On Deck club settings",
    description: "Edit your club's saved session defaults.",
    path: ON_DECK_SETTINGS_PATH,
  }),
  robots: { index: false, follow: false },
};

/**
 * The Organizer's Club settings screen (issue #254): edit the saved Session
 * defaults every one-tap Start reads from. Organizer-only, under `/home`.
 */
export default async function OnDeckClubSettingsPage() {
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
          <PageHeading eyebrow={club.name} title="Club settings" />

          <p className="mt-4 text-sm text-muted-foreground">
            Floor mode is <span className="text-foreground">{FLOOR_MODE_LABEL[club.floorMode]}</span>.
          </p>

          <ClubDefaultsForm
            venueName={club.venueName}
            courtCount={club.courtCount}
            groupCap={club.groupCap}
          />
        </div>
      </section>
    </div>
  );
}
