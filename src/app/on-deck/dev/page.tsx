import type { Metadata } from "next";

import { PageHeading } from "@/components/typography/page-heading";
import { verifyOrganizer } from "@/lib/on-deck/dal";
import { verifyDevAccess } from "@/lib/on-deck/dev";
import { createClient } from "@/lib/on-deck/supabase/server";
import { getOwnedClub } from "@/lib/on-deck/clubs";
import { getOpenSessionForClub } from "@/lib/on-deck/sessions";
import { getVolunteerToken } from "@/lib/on-deck/volunteer";
import { FLOOR_MODE_LABEL } from "@/lib/on-deck/session/types";
import { clubQrPath } from "@/lib/on-deck/routes";
import { DevConsole, type DevSnapshot } from "@/components/on-deck/dev-console";

export const metadata: Metadata = {
  title: "On Deck dev console",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * The gated dev console (issue #351): fill a real prod Session with synthetic
 * Players and drive it from a phone. Two gates — `ON_DECK_DEV_KEY` (404s
 * without it) and an Organizer session. Not linked from anywhere.
 */
export default async function OnDeckDevPage() {
  await verifyDevAccess();
  const organizer = await verifyOrganizer();
  const supabase = await createClient();
  const club = await getOwnedClub(supabase);
  const session = club
    ? await getOpenSessionForClub(supabase, club.id)
    : null;
  const volunteerToken = session
    ? await getVolunteerToken(supabase, session.config.sessionId)
    : null;

  let snapshot: DevSnapshot | null = null;
  if (session) {
    const s = session.state;
    snapshot = {
      sessionId: session.config.sessionId,
      venueName: session.config.venueName,
      courtCount: session.config.courtCount,
      floorMode: session.config.floorMode,
      groupCap: s.groupCap,
      lastCall: s.lastCallAt !== null,
      volunteerToken,
      counts: {
        roster: s.roster.length,
        queued: s.queue.length,
        playing: s.courts.reduce((n, c) => n + c.foursome.length, 0),
        onDeck: s.onDeck.reduce((n, f) => n + f.players.length, 0),
        paused: s.paused.length,
        groups: s.groups.length,
      },
      courts: s.courts.map((c) => ({
        number: c.number,
        occupied: c.foursome.length > 0,
      })),
      onDeck: s.onDeck.map((f) => f.players.length),
    };
  }

  return (
    <div className="flex w-full flex-1 flex-col">
      <section className="w-full px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-xl">
          <PageHeading eyebrow="On Deck" title="Dev console" />
          <p className="mt-3 text-sm text-muted-foreground">
            Signed in as{" "}
            <span className="text-foreground">{organizer.email}</span>. Not a
            real surface. Synthetic players, on the live database.
          </p>

          {!club ? (
            <div className="mt-8 rounded-2xl border bg-card p-6 text-sm">
              <p className="font-medium">No club on this account yet.</p>
              <p className="mt-2 text-muted-foreground">
                On Deck has no self-serve club creation and RLS gives even the
                owner no INSERT on <code>on_deck_clubs</code>. Insert one with
                the service role (Supabase SQL editor), setting{" "}
                <code>owner_id</code> to this account&apos;s user id — then
                reload.
              </p>
            </div>
          ) : (
            <DevConsole
              clubName={club.name}
              clubQrPath={clubQrPath(club.id)}
              floorModeLabel={FLOOR_MODE_LABEL[club.floorMode]}
              snapshot={snapshot}
            />
          )}
        </div>
      </section>
    </div>
  );
}
