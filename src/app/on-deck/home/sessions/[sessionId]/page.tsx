import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { pageMetadata } from "@/lib/metadata";
import { PageHeading } from "@/components/typography/page-heading";
import { verifyOrganizer } from "@/lib/on-deck/dal";
import { createClient } from "@/lib/on-deck/supabase/server";
import { getOwnedClub } from "@/lib/on-deck/clubs";
import { getScheduledSession } from "@/lib/on-deck/sessions";
import { editSessionPath } from "@/lib/on-deck/routes";
import { SessionForm } from "@/components/on-deck/session-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}): Promise<Metadata> {
  const { sessionId } = await params;
  return {
    ...pageMetadata({
      title: "Edit an On Deck session",
      description: "Change a scheduled session's date, venue, or court count.",
      path: editSessionPath(sessionId),
    }),
    robots: { index: false, follow: false },
  };
}

/**
 * Edit a not-yet-open Session (issue #254). Only a `scheduled` Session of the
 * Organizer's own Club is editable here — an open one is run on the floor
 * screen, not this.
 */
export default async function OnDeckEditSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  await verifyOrganizer();
  const supabase = await createClient();

  const club = await getOwnedClub(supabase);
  const session = await getScheduledSession(supabase, sessionId).catch(
    () => null,
  );

  if (!club || !session || session.clubId !== club.id) {
    notFound();
  }

  return (
    <div className="flex w-full flex-1 flex-col">
      <section className="w-full px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-lg">
          <PageHeading eyebrow={club.name} title="Edit session" />

          <SessionForm
            sessionId={session.id}
            scheduledFor={session.scheduledFor}
            venueName={session.venueName}
            courtCount={session.courtCount}
          />
        </div>
      </section>
    </div>
  );
}
