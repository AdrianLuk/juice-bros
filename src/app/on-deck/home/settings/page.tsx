import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { pageMetadata } from "@/lib/metadata";
import { verifyOrganizer } from "@/lib/on-deck/dal";
import { createClient } from "@/lib/on-deck/supabase/server";
import { getOwnedClub } from "@/lib/on-deck/clubs";
import { ON_DECK_HOME_PATH, ON_DECK_SETTINGS_PATH } from "@/lib/on-deck/routes";
import { ClubDefaultsForm } from "@/components/on-deck/club-defaults-form";
import { ClubClockCard } from "@/components/on-deck/club-clock-card";
import { ArenaShell } from "@/components/on-deck/arena-shell";
import { BoardHead } from "@/components/on-deck/back-office";
import { knownTimeZones } from "@/lib/on-deck/timezone";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "On Deck club settings",
    description: "Edit your club's saved session defaults.",
    path: ON_DECK_SETTINGS_PATH,
  }),
  robots: { index: false, follow: false },
};

/**
 * The Organizer's Club settings screen (issue #254; on the board since the back
 * office redesign, issue #515, surface seed 7323f5fb).
 *
 * Every value the two-field create form asked for or guessed is reachable from
 * here. The club's own name leads, at board scale, because it is the thing
 * being edited and because it is what a Player reads on the sign.
 */
export default async function OnDeckClubSettingsPage() {
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
          {/* No spec line here. On home it carries the club's values as
              facts; on this page those values are the content, sitting in the
              fields below, and restating them above would be the readout voice
              used as a caption. The panels name themselves instead. */}
          <BoardHead name={club.name} spec={[]} />

          <ClubDefaultsForm
            name={club.name}
            venueName={club.venueName}
            courtCount={club.courtCount}
            groupCap={club.groupCap}
            floorMode={club.floorMode}
          />

          <ClubClockCard timeZone={club.timeZone} zones={knownTimeZones()} />
        </div>
      </section>
    </ArenaShell>
  );
}
