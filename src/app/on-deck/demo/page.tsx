import type { Metadata } from "next";

import { pageMetadata } from "@/lib/metadata";
import { ON_DECK_DEMO_PATH } from "@/lib/on-deck/routes";
import { ArenaShell } from "@/components/on-deck/arena-shell";
import { DemoFloor } from "@/components/on-deck/demo-floor";
import { DEMO_CONFIG, DEMO_PLAYER_COUNT } from "@/lib/on-deck/demo/night";

export const metadata: Metadata = pageMetadata({
  title: "Try On Deck on a full night",
  description:
    "A club social already an hour in, running in your browser. Tap a court done and watch the next four get called. No sign-in, nothing saved.",
  path: ON_DECK_DEMO_PATH,
});

/**
 * The demo is stamped against the clock at request time so its wait times read
 * like a night in progress. Nothing here is fetched, so this is the only
 * reason the page is not static.
 */
export const dynamic = "force-dynamic";

/**
 * The demo night (issue #519). The Organizer's floor screen, folded entirely
 * in the visitor's browser off an authored event log: no account, no Club, no
 * Supabase client, no Server Action, no row written.
 *
 * It is the real screen, not a picture of one. Every tap goes through the same
 * `floor-ops` decision and the same `reduceSession` fold a Saturday night
 * runs on, which is what makes it worth trusting and what makes anything it
 * gets wrong a bug in the Floor.
 */
export default function OnDeckDemoPage() {
  return (
    <ArenaShell>
      <section className="w-full px-4 py-8 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-3xl">
          <p className="od-readout text-arena-live">● Demo</p>
          <h1 className="od-display mt-2 text-3xl text-arena-fg sm:text-4xl">
            Somebody else&apos;s Saturday, an hour in
          </h1>
          <p className="mt-4 text-arena-faint">
            Nothing on this board is real. {DEMO_PLAYER_COUNT} invented players
            have been rotating through {DEMO_CONFIG.courtCount} courts for the
            past hour, and the whole night folds in your browser. Nobody is
            signed in, nothing is saved, and nothing leaves this page.
          </p>
          <p className="mt-3 text-arena-faint">
            Tap <span className="text-arena-fg">Court 1 done</span>. The four
            who were waiting walk on, picked the way they would be at a real
            club, and the four coming off go back in the queue at the bottom.
          </p>
          <p className="od-readout mt-4 text-[0.72rem] text-arena-dim">
            Every name here ends in B. That is how you know nobody on this
            board exists.
          </p>

          <header className="mt-10 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-arena-line-soft pb-4">
            <h2 className="od-display text-2xl text-arena-dim sm:text-3xl">
              {DEMO_CONFIG.venueName}
            </h2>
            <p className="od-readout text-arena-live">● Floor screen</p>
          </header>

          <div className="mt-9">
            <DemoFloor />
          </div>
        </div>
      </section>
    </ArenaShell>
  );
}
