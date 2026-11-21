import Link from "next/link";
import { notFound } from "next/navigation";

import { DddHead } from "@/components/ddd/ddd-head";
import { LineupEditor } from "@/components/ddd/lineup-editor";
import { verifyOrganizer } from "@/lib/ddd/dal";
import { getEvent } from "@/lib/ddd/events";
import { getLineups } from "@/lib/ddd/lineup-db";
import { dddPath, rosterPath } from "@/lib/ddd/routes";
import { getRoster } from "@/lib/ddd/roster-db";
import { createClient } from "@/lib/ddd/supabase/server";

/** The Lineups, for any Organizer (issue #713): each Team's four Pairs. */
export default async function LineupsPage({ params }: { params: Promise<{ eventId: string }> }) {
  await verifyOrganizer();
  const { eventId } = await params;
  const supabase = await createClient();
  const event = await getEvent(supabase, eventId);
  if (!event) notFound();
  const teams = await getRoster(supabase, event.id);
  const lineups = await getLineups(
    supabase,
    teams.map((team) => team.id),
  );

  return (
    <>
      <DddHead event={event} back={{ href: dddPath(event.id), label: event.name }} />
      <main className="ddd-main">
        <div className="ddd-col ddd-stack-lg">
          {teams.length === 0 ? (
            <div className="ddd-slip ddd-notice">
              <p>Paste the roster first. Lineups pick from each Team&apos;s players.</p>
              <Link href={rosterPath(event.id)} className="ddd-quiet">
                Paste the roster
              </Link>
            </div>
          ) : (
            <LineupEditor teams={teams} lineups={lineups} />
          )}
        </div>
      </main>
    </>
  );
}
