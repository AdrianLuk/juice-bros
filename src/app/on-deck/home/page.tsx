import type { Metadata } from "next";
import Link from "next/link";

import { pageMetadata } from "@/lib/metadata";
import { PageHeading } from "@/components/typography/page-heading";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { verifyOrganizer } from "@/lib/on-deck/dal";
import { createClient } from "@/lib/on-deck/supabase/server";
import { getOwnedClub } from "@/lib/on-deck/clubs";
import {
  getOpenSessionForClub,
  getScheduledSessionsForClub,
} from "@/lib/on-deck/sessions";
import { signOut } from "@/lib/on-deck/actions/auth";
import { TonightControls } from "@/components/on-deck/tonight-controls";
import {
  ON_DECK_QR_DISPLAY_PATH,
  ON_DECK_SETTINGS_PATH,
  floorPath,
  sessionPath,
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

  return (
    <div className="flex w-full flex-1 flex-col">
      <section className="w-full px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-lg">
          <PageHeading eyebrow="On Deck" title="Tonight" />

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
                    Show the QR
                  </Link>
                  <Link
                    href={ON_DECK_SETTINGS_PATH}
                    className="text-sm underline underline-offset-4"
                  >
                    Edit defaults
                  </Link>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  No sign on the wall today? Pull up{" "}
                  <Link
                    href={ON_DECK_QR_DISPLAY_PATH}
                    className="underline underline-offset-4"
                  >
                    the QR
                  </Link>{" "}
                  and hold your screen up instead. Same link, printed or not.
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
