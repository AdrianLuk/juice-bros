import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { pageMetadata } from "@/lib/metadata";
import { loadVolunteerSession } from "@/lib/on-deck/volunteer";
import { floorRosterFrom, rotationViewFrom } from "@/lib/on-deck/rotation";
import { volunteerPath } from "@/lib/on-deck/routes";
import { ArenaShell } from "@/components/on-deck/arena-shell";
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
    <ArenaShell>
      <section className="w-full px-4 py-8 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-3xl">
          <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-arena-line-soft pb-4">
            <h1 className="od-display text-2xl text-arena-dim sm:text-3xl">
              {view.venueName}
            </h1>
            <p className="od-readout text-arena-dim">
              Volunteer floor
            </p>
          </header>
          <p className="mt-3 text-sm text-arena-faint">
            You&apos;re running the floor from a volunteer link. Starting,
            closing, and club settings stay with the organizer.
          </p>

          <div className="mt-9">
            <RotationBoard
              sessionId={sessionId}
              initialView={view}
              initialRoster={roster}
              auth={{ kind: "volunteer", token }}
            />
          </div>
        </div>
      </section>
    </ArenaShell>
  );
}
