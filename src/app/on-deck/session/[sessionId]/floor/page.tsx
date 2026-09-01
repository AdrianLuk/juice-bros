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
import { clubQrPath, floorPath, volunteerPath } from "@/lib/on-deck/routes";
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
    <div className="flex w-full flex-1 flex-col">
      <section className="w-full px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <p className="font-heading text-sm font-semibold tracking-[0.2em] text-brand-orange uppercase">
            {view.status === "open" ? "Floor screen" : "Session closed"}
          </p>
          <h1 className="mt-3 font-heading text-3xl font-semibold">
            {view.venueName}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Signed in as {organizer.email}. Players scan{" "}
            <Link
              href={clubQrPath(club.id)}
              className="underline underline-offset-4"
            >
              the club QR
            </Link>{" "}
            to join.
          </p>

          {volunteerUrl && (
            <div className="mt-6">
              <VolunteerLinkCard url={volunteerUrl} />
            </div>
          )}

          <div className="mt-10">
            <RotationBoard
              sessionId={sessionId}
              initialView={view}
              initialRoster={roster}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
