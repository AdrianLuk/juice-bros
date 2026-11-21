import { notFound } from "next/navigation";

import { DddHead } from "@/components/ddd/ddd-head";
import { QueryProvider } from "@/components/ddd/query-provider";
import { RoundOne } from "@/components/ddd/round-one";
import { verifyOrganizer } from "@/lib/ddd/dal";
import { getEvent, readLinkEvent } from "@/lib/ddd/events";
import { dddPath } from "@/lib/ddd/routes";
import { createClient } from "@/lib/ddd/supabase/server";

/**
 * Round 1 for any Organizer (#715): what the Public Link shows, plus
 * correcting and clearing finals, reordering Rotations and calling a tie.
 */
export default async function RoundOnePage({ params }: { params: Promise<{ eventId: string }> }) {
  await verifyOrganizer();
  const { eventId } = await params;
  const supabase = await createClient();
  const setup = await getEvent(supabase, eventId);
  if (!setup) notFound();
  const event = await readLinkEvent(supabase, setup.publicToken);
  if (!event) notFound();

  return (
    <>
      <DddHead event={event} back={{ href: dddPath(event.id), label: event.name }} />
      <main className="ddd-main">
        <div className="ddd-col">
          <QueryProvider>
            <RoundOne reader={{ kind: "organizer", eventId: event.id }} initial={event} />
          </QueryProvider>
        </div>
      </main>
    </>
  );
}
