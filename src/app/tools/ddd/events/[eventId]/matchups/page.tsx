import { notFound } from "next/navigation";

import { DddHead } from "@/components/ddd/ddd-head";
import { Matchups } from "@/components/ddd/matchups";
import { QueryProvider } from "@/components/ddd/query-provider";
import { verifyOrganizer } from "@/lib/ddd/dal";
import { getEvent, readLinkEvent } from "@/lib/ddd/events";
import { dddPath } from "@/lib/ddd/routes";
import { createClient } from "@/lib/ddd/supabase/server";

/**
 * Round 2 and the Playoff for any Organizer (#716): what the Public Link
 * shows, plus correcting and clearing finals and the call on a 2-2.
 */
export default async function MatchupsPage({ params }: { params: Promise<{ eventId: string }> }) {
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
            <Matchups reader={{ kind: "organizer", eventId: event.id }} initial={event} />
          </QueryProvider>
        </div>
      </main>
    </>
  );
}
