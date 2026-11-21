import Link from "next/link";
import { notFound } from "next/navigation";

import { CopyLink } from "@/components/ddd/copy-link";
import { DddHead } from "@/components/ddd/ddd-head";
import { absoluteAppUrl } from "@/lib/booking-buddy/request-origin";
import { verifyOrganizer } from "@/lib/ddd/dal";
import { getEvent } from "@/lib/ddd/events";
import { getRoster } from "@/lib/ddd/roster-db";
import { DDD_ROOT, editDddPath, lineupsPath, publicLinkPath, rosterPath, roundOnePath, scoreLinkPath } from "@/lib/ddd/routes";
import { createClient } from "@/lib/ddd/supabase/server";

/**
 * One DDD, for any Organizer (issue #711): its header, its courts, and the
 * Score Link and Public Link to post. The roster, Lineups and Spreads come
 * here in #712 to #714.
 */
export default async function DddPage({ params }: { params: Promise<{ eventId: string }> }) {
  await verifyOrganizer();
  const { eventId } = await params;
  const event = await getEvent(await createClient(), eventId);
  if (!event) notFound();

  const [scoreUrl, publicUrl, teams] = await Promise.all([
    absoluteAppUrl(scoreLinkPath(event.scoreToken)),
    absoluteAppUrl(publicLinkPath(event.publicToken)),
    getRoster(await createClient(), event.id),
  ]);

  return (
    <>
      <DddHead event={event} back={{ href: DDD_ROOT, label: "All DDDs" }}>
        <Link href={editDddPath(event.id)} className="ddd-quiet ddd-head-action">
          Change the setup
        </Link>
      </DddHead>
      <main className="ddd-main">
        <div className="ddd-col ddd-stack-lg">
          <section className="ddd-slip ddd-section" aria-labelledby="ddd-links">
            <h2 id="ddd-links" className="ddd-slip-head">
              Links
            </h2>
            <CopyLink label="Score Link" url={scoreUrl} note="For the group chat. Anyone holding it can enter scores." />
            <CopyLink label="Public Link" url={publicUrl} note="Read only. For phones and the TV by the courts." />
          </section>
          <section className="ddd-slip ddd-section" aria-labelledby="ddd-roster">
            <h2 id="ddd-roster" className="ddd-slip-head">
              Roster
            </h2>
            <p>
              {teams.length === 0
                ? "No roster yet. Paste the rows from the sheet."
                : `${teams.length} Teams, ${teams.reduce((sum, team) => sum + team.players.length, 0)} players.`}
            </p>
            <Link href={rosterPath(event.id)} className="ddd-quiet">
              {teams.length === 0 ? "Paste the roster" : "Open the roster"}
            </Link>
          </section>
          <section className="ddd-slip ddd-section" aria-labelledby="ddd-lineups">
            <h2 id="ddd-lineups" className="ddd-slip-head">
              Lineups
            </h2>
            <p>Each Team&apos;s four Pairs, from the group chat.</p>
            <Link href={lineupsPath(event.id)} className="ddd-quiet">
              {teams.length === 0 ? "Paste the roster first" : "Open the Lineups"}
            </Link>
          </section>
          {teams.length === 4 ? (
            <section className="ddd-slip ddd-section" aria-labelledby="ddd-round-1">
              <h2 id="ddd-round-1" className="ddd-slip-head">
                Round 1
              </h2>
              <p>Six Dreambreakers seed the Teams.</p>
              <Link href={roundOnePath(event.id)} className="ddd-quiet">
                Open the Dreambreakers
              </Link>
            </section>
          ) : null}
          <section className="ddd-slip ddd-section" aria-labelledby="ddd-courts">
            <h2 id="ddd-courts" className="ddd-slip-head">
              Courts at {event.playVenue}
            </h2>
            <ol className="ddd-court-list">
              {event.courts.map((court, index) => (
                <li key={court}>
                  <span className="ddd-court-n">{index + 1}</span>
                  <span>Court {court}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </main>
    </>
  );
}
