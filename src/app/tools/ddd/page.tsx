import Link from "next/link";

import { InviteLink } from "@/components/ddd/copy-link";
import { DddBar } from "@/components/ddd/ddd-head";
import { DddSignIn, SignOut } from "@/components/ddd/sign-in";
import { makeInviteLink } from "@/lib/ddd/actions/organizer";
import { getVisitor } from "@/lib/ddd/dal";
import { formatDddDate, listEvents } from "@/lib/ddd/events";
import { DDD_ROOT, dddPath, NEW_DDD_PATH } from "@/lib/ddd/routes";
import { createClient } from "@/lib/ddd/supabase/server";

/**
 * DDD's front door (issue #711). Signed out: Google sign-in. Signed in off
 * the Organizer list: ask an Organizer for an invite. An Organizer: every
 * DDD, newest first, and an invite link to hand on.
 */
export default async function DddHome({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const visitor = await getVisitor();

  if (visitor.kind === "signed-out") {
    const { error } = await searchParams;
    return (
      <>
        <DddBar title="Organizers sign in" />
        <main className="ddd-main">
          <div className="ddd-col ddd-slip ddd-notice">
            <p>For the people running the day. Players score from the Score Link in the group chat, no account needed.</p>
            <DddSignIn next={DDD_ROOT} failed={Boolean(error)} />
          </div>
        </main>
      </>
    );
  }

  if (visitor.kind === "not-organizer") {
    return (
      <>
        <DddBar title="Ask for an invite" />
        <main className="ddd-main">
          <div className="ddd-col ddd-slip ddd-notice">
            <p>
              {visitor.email ? <strong>{visitor.email}</strong> : "This account"} isn&apos;t an Organizer yet. Ask an
              Organizer for an invite link, then open it while signed in.
            </p>
            <SignOut />
          </div>
        </main>
      </>
    );
  }

  const events = await listEvents(await createClient());

  return (
    <>
      <DddBar title="Your DDDs" />
      <main className="ddd-main">
        <div className="ddd-col ddd-stack-lg">
          <Link href={NEW_DDD_PATH} className="ddd-btn ddd-btn-wide">
            New DDD
          </Link>
          {events.length > 0 ? (
            <ul className="ddd-slip ddd-list" aria-label="DDDs, newest first">
              {events.map((event) => (
                <li key={event.id}>
                  <Link href={dddPath(event.id)} className="ddd-list-row">
                    <span className="ddd-list-name">{event.name}</span>
                    <span className="ddd-list-meta">
                      {formatDddDate(event.date)} · {event.playVenue} · {event.dineVenue}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ddd-on-green">No DDDs yet. Every Organizer sees the ones you create.</p>
          )}
          <section className="ddd-slip ddd-section" aria-labelledby="ddd-organizers">
            <h2 id="ddd-organizers" className="ddd-slip-head">
              Organizers
            </h2>
            <p className="ddd-note">
              Every Organizer runs every DDD. To add one, send them an invite link: they open it and sign in with Google.
            </p>
            <InviteLink make={makeInviteLink} />
          </section>
          <SignOut />
        </div>
      </main>
    </>
  );
}
