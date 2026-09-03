import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { pageMetadata } from "@/lib/metadata";
import { verifyOrganizer } from "@/lib/on-deck/dal";
import { createClient } from "@/lib/on-deck/supabase/server";
import { getOwnedClub } from "@/lib/on-deck/clubs";
import { getSession } from "@/lib/on-deck/sessions";
import { floorRosterFrom, rotationViewFrom } from "@/lib/on-deck/rotation";
import { getVolunteerToken } from "@/lib/on-deck/volunteer";
import { onDeckAbsoluteUrl } from "@/lib/on-deck/request-origin";
import {
  clubQrPath,
  displayPath,
  floorPath,
  kioskPath,
  volunteerPath,
} from "@/lib/on-deck/routes";
import { ArenaShell } from "@/components/on-deck/arena-shell";
import { RotationBoard } from "@/components/on-deck/rotation-board";
import { VolunteerLinkCard } from "@/components/on-deck/volunteer-link-card";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}): Promise<Metadata> {
  const { sessionId } = await params;
  return {
    ...pageMetadata({
      title: "On Deck floor screen",
      description: "Courts and the queue for tonight's session.",
      path: floorPath(sessionId),
    }),
    robots: { index: false, follow: false },
  };
}

/**
 * The Organizer's floor screen (issue #243): every Court and who is on it, the
 * Queue in order, and a "Court N done" tap that re-queues the four coming off
 * and sends the longest-waiting Foursome on. Organizer-only — a Player reads
 * the Session view, not this.
 */
export default async function FloorPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const organizer = await verifyOrganizer();
  const supabase = await createClient();

  const club = await getOwnedClub(supabase);
  const loaded = await getSession(supabase, sessionId).catch(() => null);
  if (!club || !loaded || loaded.config.clubId !== club.id) {
    notFound();
  }

  const view = rotationViewFrom(loaded);
  const roster = floorRosterFrom(loaded);

  // The Volunteer Link is offered only for the *open* Session, and only when
  // Floor Mode includes volunteers (volunteer-run / hybrid) — under self-serve
  // it is inert, so it isn't shown.
  const volunteerToken =
    loaded.status === "open" && loaded.config.floorMode !== "self-serve"
      ? await getVolunteerToken(supabase, sessionId)
      : null;
  const volunteerUrl = volunteerToken
    ? await onDeckAbsoluteUrl(volunteerPath(sessionId, volunteerToken))
    : null;

  return (
    <ArenaShell>
      <section className="w-full px-4 py-8 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-3xl">
          <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-arena-line-soft pb-4">
            <h1 className="od-display text-2xl text-arena-dim sm:text-3xl">
              {view.venueName}
            </h1>
            <p
              className={`od-readout ${
                view.status === "open" ? "text-arena-live" : "text-arena-faint"
              }`}
            >
              {view.status === "open" ? "● Floor screen" : "Session closed"}
            </p>
          </header>
          <p className="mt-3 text-sm text-arena-faint">
            Signed in as {organizer.email}. Players scan{" "}
            <Link
              href={clubQrPath(club.id)}
              className="text-arena-dim underline underline-offset-4 hover:text-arena-fg"
            >
              the club QR
            </Link>{" "}
            to join.
          </p>
          {view.status === "open" && (
            <p className="mt-2 text-sm text-arena-faint">
              Got a spare screen?{" "}
              <Link
                href={displayPath(sessionId)}
                className="text-arena-dim underline underline-offset-4 hover:text-arena-fg"
              >
                Open the display
              </Link>{" "}
              on it. A read-only board of courts, the queue, and who&apos;s on
              deck.
              {loaded.config.floorMode !== "volunteer-run" && (
                <>
                  {" "}
                  Or, for a screen by the courts,{" "}
                  <Link
                    href={kioskPath(sessionId)}
                    className="text-arena-dim underline underline-offset-4 hover:text-arena-fg"
                  >
                    open the kiosk
                  </Link>{" "}
                  instead: the same board plus the turnover buttons, tappable by
                  anyone playing.
                </>
              )}
            </p>
          )}

          {volunteerUrl && (
            <div className="mt-6">
              <VolunteerLinkCard url={volunteerUrl} />
            </div>
          )}

          <div className="mt-9">
            <RotationBoard
              sessionId={sessionId}
              initialView={view}
              initialRoster={roster}
            />
          </div>
        </div>
      </section>
    </ArenaShell>
  );
}
