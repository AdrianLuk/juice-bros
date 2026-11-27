import Link from "next/link";
import { notFound } from "next/navigation";

import { DddHead } from "@/components/ddd/ddd-head";
import { SpreadsEditor } from "@/components/ddd/spreads-editor";
import { verifyOrganizer } from "@/lib/ddd/dal";
import { getEvent } from "@/lib/ddd/events";
import { getLineups } from "@/lib/ddd/lineup-db";
import { dddPath, rosterPath } from "@/lib/ddd/routes";
import { getRoster } from "@/lib/ddd/roster-db";
import { getSpreads } from "@/lib/ddd/spreads-db";
import { createClient } from "@/lib/ddd/supabase/server";

/** The 24 Spreads, for any Organizer (issue #714): 6 Team pairings x 4 Games. */
export default async function SpreadsPage({ params }: { params: Promise<{ eventId: string }> }) {
  await verifyOrganizer();
  const { eventId } = await params;
  const supabase = await createClient();
  const event = await getEvent(supabase, eventId);
  if (!event) notFound();
  const teams = await getRoster(supabase, event.id);
  const ids = teams.map((team) => team.id);
  const [lineups, spreads] = await Promise.all([getLineups(supabase, ids), getSpreads(supabase, ids)]);

  return (
    <>
      <DddHead event={event} back={{ href: dddPath(event.id), label: event.name }} />
      <main className="ddd-main">
        <div className="ddd-col ddd-stack-lg">
          {teams.length === 0 ? (
            <div className="ddd-slip ddd-notice">
              <p>Paste the roster first. Forecasts are set between its Teams.</p>
              <Link href={rosterPath(event.id)} className="ddd-quiet">
                Paste the roster
              </Link>
            </div>
          ) : (
            <SpreadsEditor eventId={event.id} teams={teams} lineups={lineups} spreads={spreads} />
          )}
        </div>
      </main>
    </>
  );
}
