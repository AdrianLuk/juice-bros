import type { Metadata } from "next";
import Link from "next/link";

import { DemoStage } from "@/components/team-tally/demo-stage";
import { TtHead } from "@/components/team-tally/tt-head";
import { pageMetadata } from "@/lib/metadata";
import { clubToday } from "@/lib/team-tally/format";
import { TEAM_TALLY_DEMO_PATH, TEAM_TALLY_NEW_EVENT_PATH, TEAM_TALLY_SIGN_IN_PATH } from "@/lib/team-tally/routes";

export const metadata: Metadata = pageMetadata({
  title: "Try a Team Tally demo night",
  description:
    "A captained team night already under way, running in your browser. Score a game, watch the Flights place themselves and the night end on its results. No sign-in, nothing saved.",
  path: TEAM_TALLY_DEMO_PATH,
});

/** Dated today at the club, so the night reads as tonight's. That is the only reason the page isn't static. */
export const dynamic = "force-dynamic";

/** Sign in, then straight to building a night. */
const BUILD_A_NIGHT = `${TEAM_TALLY_SIGN_IN_PATH}?next=${encodeURIComponent(TEAM_TALLY_NEW_EVENT_PATH)}`;

/**
 * The demo night (issue #631): Team Tally's real screens on one night folded
 * entirely in the visitor's browser. No account, no Supabase client, no
 * Server Action, nothing saved; `demo/import-graph.test.ts` holds the page to
 * that. Every write goes through the same rules a real night runs on.
 */
export default function TeamTallyDemoPage() {
  return (
    <div className="flex w-full flex-1 flex-col">
      <TtHead
        context="Demo night"
        title="Try a demo night"
        meta="Nothing here is real or saved"
        lead={
          <>
            Fourteen teams are most of the way through their opening Matchups. You hold the Score Link for Golden
            Set, Ben Johns&apos;s team, and Round 2 is waiting on your score. Enter it, then look at the TV. Let it
            run plays out the other courts until the Flights are placed and the results go up.
          </>
        }
      />

      <section aria-label="Demo night" className="tt-wrap pb-16 sm:pb-20">
        <DemoStage date={clubToday()} />
      </section>

      <section className="tt-wrap pb-20 sm:pb-28">
        <div className="tt-sheet mx-auto max-w-3xl">
          <div className="tt-section-head">
            <h2 className="tt-h2">Run your own night</h2>
          </div>
          <div className="tt-section-body grid justify-items-start gap-5">
            <p className="tt-body m-0">
              Sign in with Google and set up your teams and Matchups. If you already send a brief by hand, paste last
              week&apos;s and the form fills itself in.
            </p>
            <Link href={BUILD_A_NIGHT} className="tt-btn" data-testid="demo-build-a-night">
              Build a real night
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
