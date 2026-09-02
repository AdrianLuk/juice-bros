import type { Metadata } from "next";
import Link from "next/link";

import { pageMetadata } from "@/lib/metadata";
import { PageHeading } from "@/components/typography/page-heading";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { verifyOrganizer } from "@/lib/on-deck/dal";
import { createClient } from "@/lib/on-deck/supabase/server";
import { getOwnedClub } from "@/lib/on-deck/clubs";
import {
  getOpenSessionForClub,
  getScheduledSessionsForClub,
} from "@/lib/on-deck/sessions";
import { signOut } from "@/lib/on-deck/actions/auth";
import { StartSessionButton } from "@/components/on-deck/start-session-button";
import {
  ON_DECK_NEW_SESSION_PATH,
  ON_DECK_SETTINGS_PATH,
  clubQrPath,
  editSessionPath,
  floorPath,
  sessionPath,
} from "@/lib/on-deck/routes";
import { FLOOR_MODE_LABEL } from "@/lib/on-deck/session/types";

/** `YYYY-MM-DD` → "Sat, Mar 14" (dates carry no time; read them as UTC). */
function formatSessionDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export const metadata: Metadata = pageMetadata({
  title: "On Deck home",
  description: "Start tonight's session from your club's saved defaults.",
  path: "/on-deck/home",
});

export default async function OnDeckHomePage() {
  const organizer = await verifyOrganizer();
  const supabase = await createClient();
  const club = await getOwnedClub(supabase);
  const openSession = club
    ? await getOpenSessionForClub(supabase, club.id)
    : null;
  const scheduledSessions =
    club && !openSession
      ? await getScheduledSessionsForClub(supabase, club.id)
      : [];
  const todayIso = new Date().toISOString().slice(0, 10);
  // Matches `on_deck_start_session`: the most recent due date is the one Start
  // opens (`scheduledSessions` is soonest-first, so that is the last due one).
  const dueSession = scheduledSessions
    .filter((s) => s.scheduledFor <= todayIso)
    .at(-1);

  return (
    <div className="flex w-full flex-1 flex-col">
      <section className="w-full px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-lg">
          <PageHeading eyebrow="On Deck" title="Tonight" />

          {!club ? (
            <div className="mt-8 rounded-2xl border bg-card p-6 text-sm text-muted-foreground">
              <p>
                No club is set up for{" "}
                <span className="text-foreground">{organizer.email}</span> yet.
                On Deck clubs are created by hand for now. Get in touch and
                we&apos;ll set yours up.
              </p>
              <Link
                href="/contact"
                className={cn(buttonVariants({ variant: "outline" }), "mt-4")}
              >
                Contact us
              </Link>
            </div>
          ) : (
            <div className="mt-8 space-y-6">
              <div className="rounded-2xl border bg-card p-6">
                <h2 className="font-heading text-xl font-semibold">
                  {club.name}
                </h2>
                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <dt className="text-muted-foreground">Venue</dt>
                  <dd>{club.venueName}</dd>
                  <dt className="text-muted-foreground">Courts</dt>
                  <dd>{club.courtCount}</dd>
                  <dt className="text-muted-foreground">Group cap</dt>
                  <dd>{club.groupCap}</dd>
                  <dt className="text-muted-foreground">Floor Mode</dt>
                  <dd>{FLOOR_MODE_LABEL[club.floorMode]}</dd>
                </dl>
                <p className="mt-4 text-xs text-muted-foreground">
                  Club QR sign points at{" "}
                  <Link
                    href={clubQrPath(club.id)}
                    className="underline underline-offset-4"
                  >
                    {clubQrPath(club.id)}
                  </Link>
                </p>
                <Link
                  href={ON_DECK_SETTINGS_PATH}
                  className="mt-4 inline-block text-sm underline underline-offset-4"
                >
                  Edit defaults
                </Link>
              </div>

              {openSession ? (
                <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6">
                  <p className="text-sm font-medium">A session is running.</p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link
                      href={floorPath(openSession.config.sessionId)}
                      className={cn(buttonVariants())}
                    >
                      Open the floor screen
                    </Link>
                    <Link
                      href={sessionPath(openSession.config.sessionId)}
                      className={cn(buttonVariants({ variant: "outline" }))}
                    >
                      Player view
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border bg-card p-6">
                  <p className="text-sm text-muted-foreground">
                    {dueSession ? (
                      <>
                        Start opens the session you set up for{" "}
                        <span className="text-foreground">
                          {formatSessionDate(dueSession.scheduledFor)}
                        </span>
                        : {dueSession.venueName}, {dueSession.courtCount} courts.
                      </>
                    ) : (
                      <>
                        Opens a session from the defaults above. You can rename
                        courts and adjust things once it&apos;s running.
                      </>
                    )}
                  </p>
                  <StartSessionButton />
                </div>
              )}

              {!openSession && (
                <div className="rounded-2xl border bg-card p-6">
                  <div className="flex items-center justify-between gap-4">
                    <h2 className="font-heading text-lg font-semibold">
                      Scheduled sessions
                    </h2>
                    <Link
                      href={ON_DECK_NEW_SESSION_PATH}
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" }),
                      )}
                    >
                      Schedule a session
                    </Link>
                  </div>

                  {scheduledSessions.length === 0 ? (
                    <p className="mt-3 text-sm text-muted-foreground">
                      Nothing scheduled. Set one up ahead of time to give a night
                      its own venue or court count.
                    </p>
                  ) : (
                    <ul
                      className="mt-4 divide-y"
                      data-testid="scheduled-sessions"
                    >
                      {scheduledSessions.map((session) => (
                        <li
                          key={session.id}
                          className="flex items-center justify-between gap-4 py-3 text-sm"
                        >
                          <div>
                            <p className="font-medium">
                              {formatSessionDate(session.scheduledFor)}
                              {dueSession?.id === session.id && (
                                <span className="ml-2 rounded-full bg-brand-orange/10 px-2 py-0.5 text-xs font-medium text-brand-orange">
                                  Start opens this
                                </span>
                              )}
                            </p>
                            <p className="text-muted-foreground">
                              {session.venueName}, {session.courtCount} courts
                            </p>
                          </div>
                          <Link
                            href={editSessionPath(session.id)}
                            className="underline underline-offset-4"
                          >
                            Edit
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          <form action={signOut} className="mt-10">
            <button
              type="submit"
              className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Sign out
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
