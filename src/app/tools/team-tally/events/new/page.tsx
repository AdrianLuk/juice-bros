import type { Metadata } from "next";
import Link from "next/link";

import { PageHead } from "@/components/bx/page-head";
import { SetupForm } from "@/components/team-tally/setup-form";
import { pageMetadata } from "@/lib/metadata";
import { verifyOrganizer } from "@/lib/team-tally/dal";
import { clubToday } from "@/lib/team-tally/format";
import { TEAM_TALLY_NEW_EVENT_PATH, TEAM_TALLY_ROOT } from "@/lib/team-tally/routes";
import { comingTuesday } from "@/lib/team-tally/setup";

export const metadata: Metadata = pageMetadata({
  title: "New Team Event",
  description: "Set up a team night's teams and Matchups.",
  path: TEAM_TALLY_NEW_EVENT_PATH,
});

export default async function NewTeamEventPage() {
  await verifyOrganizer();

  return (
    <div className="flex w-full flex-1 flex-col">
      <PageHead
        title="New Team Event"
        lead="Enter each Matchup's two Teams. A Matchup plays on its two Teams' home courts."
      />
      <section className="bx-measure pb-20 sm:pb-28">
        <SetupForm defaultDate={comingTuesday(clubToday())} />
        <Link href={TEAM_TALLY_ROOT} className="bx-quietlink mt-10 inline-block">
          Back to your Team Events
        </Link>
      </section>
    </div>
  );
}
