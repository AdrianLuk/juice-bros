import type { Metadata } from "next";
import Link from "next/link";

import { pageMetadata } from "@/lib/metadata";
import { PageHeading } from "@/components/typography/page-heading";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { verifyOrganizer } from "@/lib/on-deck/dal";
import { createClient } from "@/lib/on-deck/supabase/server";
import { getOwnedClub } from "@/lib/on-deck/clubs";
import { getSummariesForClub } from "@/lib/on-deck/summaries";
import { nightLabel } from "@/lib/on-deck/night-label";
import {
  getOpenSessionForClub,
  getScheduledSessionsForClub,
} from "@/lib/on-deck/sessions";
import { signOut } from "@/lib/on-deck/actions/auth";
import { TonightControls } from "@/components/on-deck/tonight-controls";
import { AdoptTimeZone } from "@/components/on-deck/adopt-time-zone";
import {
  ON_DECK_QR_DISPLAY_PATH,
  ON_DECK_SETTINGS_PATH,
  ON_DECK_SUMMARIES_PATH,
  floorPath,
  sessionPath,
  summaryPath,
} from "@/lib/on-deck/routes";
import { FLOOR_MODE_LABEL } from "@/lib/on-deck/session/types";

export const metadata: Metadata = pageMetadata({
  title: "On Deck home",
  description: "Start tonight's session from your club's saved defaults.",
  path: "/on-deck/home",
});

export default async function OnDeckHomePage() {
  const organizer = await verifyOrganizer();
  const supabase = await createClient();
  const club = await getOwnedClub(supabase);
  const openSession = club
    ? await getOpenSessionForClub(supabase, club.id)
    : null;
  const scheduledSessions =
    club && !openSession
      ? await getScheduledSessionsForClub(supabase, club.id)
      : [];
  // The three most recent closed nights. The full list has its own page; this
  // is the way in, so the reader is not something you have to know the URL of.
  const pastNights = club ? await getSummariesForClub(supabase, club.id, 3) : [];

  return (
    <div className="flex w-full flex-1 flex-col">
      <section className="w-full px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-lg">
          <PageHeading eyebrow="On Deck" title="Tonight" />

          {/* The Club's clock, established from the Organizer's own browser
              rather than asked for. Mounted only while it is unset, so this is
              one write on one visit and nothing thereafter. */}
          {club && club.timeZone === null ? <AdoptTimeZone /> : null}

          {!club ? (
            <div className="mt-8 rounded-2xl border bg-card p-6 text-sm text-muted-foreground">
              <p>
                No club is set up for{" "}
                <span className="text-foreground">{organizer.email}</span> yet.
                On Deck clubs are created by hand for now. Get in touch and
                we&apos;ll set yours up.
              </p>
              <Link
                href="/contact"
                className={cn(buttonVariants({ variant: "outline" }), "mt-4")}
              >
                Contact us
              </Link>
            </div>
          ) : (
            <div className="mt-8 space-y-6">
              <div className="rounded-2xl border bg-card p-6">
                <h2 className="font-heading text-xl font-semibold">
                  {club.name}
                </h2>
                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <dt className="text-muted-foreground">Venue</dt>
                  <dd>{club.venueName}</dd>
                  <dt className="text-muted-foreground">Courts</dt>
                  <dd>{club.courtCount}</dd>
                  <dt className="text-muted-foreground">Group cap</dt>
                  <dd>{club.groupCap}</dd>
                  <dt className="text-muted-foreground">Floor Mode</dt>
                  <dd>{FLOOR_MODE_LABEL[club.floorMode]}</dd>
                </dl>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Link
                    href={ON_DECK_QR_DISPLAY_PATH}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                  >
                    The club sign
                  </Link>
                  <Link
                    href={ON_DECK_SETTINGS_PATH}
                    className="text-sm underline underline-offset-4"
                  >
                    Edit defaults
                  </Link>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Print it once and it works every week. No sign on the wall
                  today? Open{" "}
                  <Link
                    href={ON_DECK_QR_DISPLAY_PATH}
                    className="underline underline-offset-4"
                  >
                    the same page
                  </Link>{" "}
                  and hold your screen up instead.
                </p>
              </div>

              {openSession ? (
                <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6">
                  <p className="text-sm font-medium">A session is running.</p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link
                      href={floorPath(openSession.config.sessionId)}
                      className={cn(buttonVariants())}
                    >
                      Open the floor screen
                    </Link>
                    <Link
                      href={sessionPath(openSession.config.sessionId)}
                      className={cn(buttonVariants({ variant: "outline" }))}
                    >
                      Player view
                    </Link>
                  </div>
                </div>
              ) : (
                <TonightControls scheduledSessions={scheduledSessions} />
              )}

              {/* Past nights. Shown only once there are some — before the
                  club's first closed Session this would be a card explaining
                  an absence, on the one screen that should be about tonight. */}
              {pastNights.length > 0 ? (
                <div className="rounded-2xl border bg-card p-6">
                  <h2 className="font-heading text-base font-semibold">
                    Past nights
                  </h2>
                  <ul className="mt-3 flex flex-col gap-2">
                    {pastNights.map((night) => (
                      <li key={night.sessionId}>
                        <Link
                          href={summaryPath(night.sessionId)}
                          className="flex flex-wrap items-baseline justify-between gap-x-4 text-sm underline-offset-4 hover:underline"
                        >
                          <span>{nightLabel(night.startedAt, night.timeZone)}</span>
                          <span className="tabular-nums text-muted-foreground">
                            {night.attendance} played, {night.gamesPlayed} games
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={ON_DECK_SUMMARIES_PATH}
                    className="mt-4 inline-block text-sm underline underline-offset-4"
                  >
                    All past nights
                  </Link>
                </div>
              ) : null}
            </div>
          )}

          <form action={signOut} className="mt-10">
            <button
              type="submit"
              className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Sign out
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
