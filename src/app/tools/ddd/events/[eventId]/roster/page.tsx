import { notFound } from "next/navigation";

import { DddHead } from "@/components/ddd/ddd-head";
import { RosterEditor } from "@/components/ddd/roster-editor";
import { RosterPaste } from "@/components/ddd/roster-paste";
import { verifyOrganizer } from "@/lib/ddd/dal";
import { getEvent } from "@/lib/ddd/events";
import { dddPath } from "@/lib/ddd/routes";
import { getRoster } from "@/lib/ddd/roster-db";
import { createClient } from "@/lib/ddd/supabase/server";

/**
 * The roster, for any Organizer (issue #712): paste the sheet's rows, then
 * edit, add, remove or move any player.
 */
export default async function RosterPage({ params }: { params: Promise<{ eventId: string }> }) {
  await verifyOrganizer();
  const { eventId } = await params;
  const supabase = await createClient();
  const event = await getEvent(supabase, eventId);
  if (!event) notFound();
  const teams = await getRoster(supabase, event.id);

  return (
    <>
      <DddHead event={event} back={{ href: dddPath(event.id), label: event.name }} />
      <main className="ddd-main">
        <div className="ddd-col ddd-stack-lg">
          {teams.length > 0 ? <RosterEditor teams={teams} /> : null}
          <RosterPaste eventId={event.id} hasRoster={teams.length > 0} />
        </div>
      </main>
    </>
  );
}
