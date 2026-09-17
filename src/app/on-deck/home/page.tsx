import type { Metadata } from "next";
import Link from "next/link";

import { pageMetadata } from "@/lib/metadata";
import { verifyOrganizer } from "@/lib/on-deck/dal";
import { createClient } from "@/lib/on-deck/supabase/server";
import { getOwnedClub } from "@/lib/on-deck/clubs";
import { readClubDraft } from "@/lib/on-deck/club-draft-server";
import { getSummariesForClub } from "@/lib/on-deck/summaries";
import { sessionDate } from "@/lib/on-deck/session-date";
import {
  getScheduledSessionsForClub,
  resolveOpenSessionForClub,
} from "@/lib/on-deck/sessions";
import { signOut } from "@/lib/on-deck/actions/auth";
import {
  ScheduledRows,
  TonightControls,
} from "@/components/on-deck/tonight-controls";
import { CreateClubForm } from "@/components/on-deck/create-club-form";
import { AdoptTimeZone } from "@/components/on-deck/adopt-time-zone";
import { ClearStrayClubDraft } from "@/components/on-deck/clear-stray-club-draft";
import { ArenaShell } from "@/components/on-deck/arena-shell";
import { BoardHead, Row, RowList, Stage } from "@/components/on-deck/back-office";
import {
  ON_DECK_QR_DISPLAY_PATH,
  ON_DECK_SETTINGS_PATH,
  ON_DECK_SUMMARIES_PATH,
  floorPath,
  summaryPath,
} from "@/lib/on-deck/routes";
import { FLOOR_MODE_LABEL } from "@/lib/on-deck/session/types";

export const metadata: Metadata = pageMetadata({
  title: "On Deck home",
  description: "Start tonight's session from your club's saved defaults.",
  path: "/on-deck/home",
});

/**
 * The Organizer's home screen, on the board (issue #515, surface seed
 * 7323f5fb).
 *
 * "One thing lit": the club's name is the page's only heading, one panel below
 * it carries the single thing to do right now, and everything else is a row on
 * a hairline. The panel is the same object in every state and only its tone and
 * its key change — the cool imminent wash while something is waiting for the
 * Organizer, orange only when a Session is genuinely running, which is the same
 * ration on orange the live board keeps.
 *
 * What this replaced was a column of five same-weight shadcn cards on the light
 * theme: the club, the start control, the scheduled nights, the past nights,
 * each as loud as the others, and the one thing the Organizer came to do buried
 * in the middle of them.
 */
export default async function OnDeckHomePage() {
  const organizer = await verifyOrganizer();
  const supabase = await createClient();
  const club = await getOwnedClub(supabase);
  // Read regardless of `club`: a Club owner with a stray draft still typed
  // one, and knowing that (rather than skipping the read) is what lets
  // `ClearStrayClubDraft` mount only when there's actually something to
  // clear, instead of on every visit from every Organizer who already has
  // a Club — the common case, and the one with nothing to do here.
  const draft = await readClubDraft();
  const openSession = club
    ? await resolveOpenSessionForClub(supabase, club.id)
    : null;
  const scheduledSessions =
    club && !openSession
      ? await getScheduledSessionsForClub(supabase, club.id)
      : [];
  // The three most recent closed nights. The full list has its own page; this
  // is the way in, so the reader is not something you have to know the URL of.
  const pastSessions = club ? await getSummariesForClub(supabase, club.id, 3) : [];

  return (
    <ArenaShell>
      <section className="w-full flex-1 px-5 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto w-full max-w-xl">
          {/* The Club's clock, established from the Organizer's own browser
              rather than asked for. Mounted only while it is unset, so this is
              one write on one visit and nothing thereafter. */}
          {club && club.timeZone === null ? <AdoptTimeZone /> : null}

          {/* A draft (issue #520) only ever belongs to the Organizer who is
              about to create a Club with it. One who already has a Club
              never reaches `CreateClubForm` to consume it, so a stray cookie
              from an earlier, unrelated attempt on this browser is cleared
              here instead — mounted only when there's actually one to clear. */}
          {club && draft ? <ClearStrayClubDraft /> : null}

          {!club ? (
            /* No club yet: the form owns the heading too, because the heading
               is the club's name and the name is what is being typed.
               `draft` is whatever was typed on the sign-in page before this
               Organizer signed in (issue #520) — `key`ed on its own content so
               a second sign-in carrying a different draft actually replaces
               the fields rather than leaving stale text from the first. */
            <CreateClubForm
              key={draft ? JSON.stringify(draft) : "no-draft"}
              initialDraft={draft}
            />
          ) : (
            <>
              <BoardHead
                name={club.name}
                spec={[
                  // A brand-new Club's venue *is* its name, because that is
                  // what the two-field form defaults it to. Printing it twice
                  // reads as a bug to somebody who has not seen the form.
                  ...(club.venueName === club.name ? [] : [club.venueName]),
                  `${club.courtCount} ${club.courtCount === 1 ? "court" : "courts"}`,
                  `Cap ${club.groupCap}`,
                  FLOOR_MODE_LABEL[club.floorMode],
                ]}
              />

              {openSession ? (
                <Stage tone="live">
                  <p className="od-bo-note">
                    A session is running right now. The floor screen is where you
                    turn courts over; the players are watching the same night
                    from their own phones.
                  </p>
                  {/* The key keeps its own milled face on the orange
                      ground rather than inverting to white. It is a control
                      set into a lit panel, which is what every key on the
                      board is, and cool-white on the raised metal measures
                      14.5:1 against a white-on-orange key's 3.15. */}
                  <Link
                    href={floorPath(openSession.config.sessionId)}
                    className="od-key od-key--turnover"
                  >
                    Open the floor
                  </Link>
                </Stage>
              ) : (
                <TonightControls scheduledSessions={scheduledSessions} />
              )}

              <RowList>
                {!openSession && (
                  <ScheduledRows scheduledSessions={scheduledSessions} />
                )}

                <Row href={ON_DECK_QR_DISPLAY_PATH} label="The club sign" />

                {pastSessions.length > 0 ? (
                  pastSessions.map((session) => (
                    <Row
                      key={session.sessionId}
                      href={summaryPath(session.sessionId)}
                      label={sessionDate({
                        at: session.startedAt,
                        timeZone: session.timeZone,
                      })}
                      sub={
                        session.autoClosed ? "Closed automatically" : undefined
                      }
                      value={`${session.attendance} played · ${session.gamesPlayed} games`}
                    />
                  ))
                ) : (
                  /* Before the first close this is the way *in* and nothing
                     more. The old design was right that home should not
                     explain an absence on the one screen that is about
                     tonight; a destination with no sub-line does not. */
                  <Row href={ON_DECK_SUMMARIES_PATH} label="Past nights" />
                )}

                {pastSessions.length > 0 && (
                  <Row href={ON_DECK_SUMMARIES_PATH} label="All past nights" />
                )}

                <Row href={ON_DECK_SETTINGS_PATH} label="Club settings" />
              </RowList>
            </>
          )}

          <div className="od-bo-foot od-readout">
            <span>{organizer.email}</span>
            <form action={signOut}>
              <button type="submit" className="od-readout">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </section>
    </ArenaShell>
  );
}
