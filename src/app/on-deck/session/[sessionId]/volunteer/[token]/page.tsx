import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { pageMetadata } from "@/lib/metadata";
import { loadVolunteerSession } from "@/lib/on-deck/volunteer";
import { floorRosterFrom, rotationViewFrom } from "@/lib/on-deck/rotation";
import { volunteerPath } from "@/lib/on-deck/routes";
import { RotationBoard } from "@/components/on-deck/rotation-board";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ sessionId: string; token: string }>;
}): Promise<Metadata> {
  const { sessionId, token } = await params;
  return {
    ...pageMetadata({
      title: "On Deck volunteer floor",
      description: "Run tonight's court rotation.",
      path: volunteerPath(sessionId, token),
    }),
    robots: { index: false, follow: false },
  };
}

/**
 * The Volunteer Link floor screen (issue #248): the same Courts / Queue / On
 * Deck board and turnover actions the Organizer has, minus Club and Session
 * settings. No account — the token in the path is the credential, checked by
 * `loadVolunteerSession` (which also refuses a closed Session or one whose
 * Floor Mode has dropped volunteers). Every action carries the token back so
 * the database re-checks the scope.
 */
export default async function VolunteerFloorPage({
  params,
}: {
  params: Promise<{ sessionId: string; token: string }>;
}) {
  const { sessionId, token } = await params;

  const loaded = await loadVolunteerSession(sessionId, token);
  if (!loaded) {
    notFound();
  }

  const view = rotationViewFrom(loaded);
  const roster = floorRosterFrom(loaded);

  return (
    <div className="flex w-full flex-1 flex-col">
      <section className="w-full px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <p className="font-heading text-sm font-semibold tracking-[0.2em] text-brand-orange uppercase">
            Volunteer floor
          </p>
          <h1 className="mt-3 font-heading text-3xl font-semibold">
            {view.venueName}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You&apos;re running the floor from a volunteer link. Starting,
            closing, and club settings stay with the organizer.
          </p>

          <div className="mt-10">
            <RotationBoard
              sessionId={sessionId}
              initialView={view}
              initialRoster={roster}
              auth={{ kind: "volunteer", token }}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
