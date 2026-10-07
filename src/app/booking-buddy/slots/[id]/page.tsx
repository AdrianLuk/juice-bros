import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { pageMetadata } from "@/lib/metadata";
import { BbPageHeading } from "@/components/booking-buddy/bb/page-heading";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DeleteSlotButton,
  NotesForm,
  ResponseButtons,
  SlotCapacityPanel,
  SlotCourts,
  SlotStatusBadge,
} from "@/components/booking-buddy/slots";
import { SlotLinkPanel } from "@/components/booking-buddy/slot-links";
import { ReminderOffsetForm } from "@/components/booking-buddy/reminders";
import { IntendedOrgForm } from "@/components/booking-buddy/booking-window";
import { BbFooter } from "@/components/booking-buddy/bb-footer";
import { RepeatsChip } from "@/components/booking-buddy/repeats-chip";
import { SkipWeekButton } from "@/components/booking-buddy/standing-game-skips";
import {
  gameOffRecipients,
  skipWeekNotice,
} from "@/lib/booking-buddy/standing-game-skips";
import { CourtSuggestions } from "@/components/booking-buddy/court-suggestion";
import { BookACourtNotes } from "@/components/booking-buddy/book-a-court";
import { standingGamePath } from "@/lib/booking-buddy/routes";
import {
  makeWeeklyHref,
  weeklyPrefillFromSlot,
} from "@/lib/booking-buddy/make-weekly";
import { WEEKDAY_NAMES } from "@/lib/booking-buddy/standing-games";
import { verifySession } from "@/lib/booking-buddy/dal";
import { getSlotDetail } from "@/lib/booking-buddy/actions/slots";
import { getSlotLink } from "@/lib/booking-buddy/actions/slot-links";
import { listCourtMatches } from "@/lib/booking-buddy/actions/court-matches";
import { listBookACourtNotes } from "@/lib/booking-buddy/actions/book-a-court";
import { withoutCourtMatches } from "@/lib/booking-buddy/book-a-court";
export const metadata: Metadata = pageMetadata({
  title: "Game",
  description: "See who's in, and add your own response.",
  path: "/booking-buddy/slots",
});
export default async function SlotDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Authoritative check. The proxy already bounced signed-out visitors, but
  // that check is optimistic and must not be relied on alone.
  const session = await verifySession();
  const detail = await getSlotDetail(id);
  // A missing row and one RLS hid are indistinguishable on purpose (see
  // `getSlotDetail`) — both read as "not found", never as "no permission",
  // which would confirm the Slot exists to someone who can't see it.
  if (!detail) {
    notFound();
  }
  const {
    slot,
    isOwner,
    responses,
    myAnswer,
    capacity,
    reminderOffsetMinutes,
    intendedOrgId,
    ownedOrgs,
    notes,
    standingGameId,
    proposedEnd,
    timeZone,
  } = detail;
  const [slotLink, allCourtMatches, bookACourtNotes] = await Promise.all([
    isOwner ? getSlotLink(slot.id) : null,
    // Only a Standing Game's posted game gets "Attach your court?" (#582).
    standingGameId ? listCourtMatches() : [],
    // "Book a court" (#573) is the organizer's own to-do, never a friend's.
    isOwner ? listBookACourtNotes() : [],
  ]);
  const courtMatches = allCourtMatches.filter(
    (match) => match.slotId === slot.id,
  );
  // A Standing Game's posted game is skipped, not deleted (#578): the confirm
  // says who hears it's off.
  const gameStarted = new Date(slot.proposedStart) <= new Date();
  const skipNotice = skipWeekNotice(
    gameOffRecipients(responses, session.userId, { started: gameStarted })
      .length,
    { started: gameStarted },
  );
  // "Make this weekly" (#581): only on the organizer's own one-off game. It
  // links to Post a game prefilled from this game; this game stays as it is.
  const weeklyPrefill =
    isOwner && !standingGameId
      ? weeklyPrefillFromSlot(
          {
            id: slot.id,
            proposedStart: slot.proposedStart,
            proposedEnd,
            timeZone,
            division: capacity.division,
            intendedOrgId,
            notes,
            rotationBuffer: capacity.rotationBuffer,
            reminderOffsetMinutes,
          },
          responses,
          session.userId,
        )
      : null;
  return (
    <div className="flex w-full flex-1 flex-col">
      <section className="w-full px-2.5 pt-6 pb-16 sm:px-6 sm:pt-16 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <BbPageHeading
            title={slot.when.replace(/,\s*\d{4}/, "")}
            description={
              isOwner ? "Proposed by you" : `Proposed by ${slot.ownerName}`
            }
            // Morphs out of the game row's own title on the way in (slots.tsx).
            titleViewTransitionName={`bb-slot-title-${id}`}
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {slot.facilityLabel && (
              <span className="bb-tape text-xs">{slot.facilityLabel}</span>
            )}
            <SlotStatusBadge courtCount={slot.courtCount} />
            {slot.repeatsLabel && <RepeatsChip label={slot.repeatsLabel} />}
            {standingGameId && (
              <Link
                href={standingGamePath(standingGameId)}
                className="text-xs underline underline-offset-4"
              >
                Edit the weekly game
              </Link>
            )}
          </div>
          {/* The game's notice spot: owner-only to-dos about this game. */}
          <BookACourtNotes
            notes={withoutCourtMatches(
              bookACourtNotes.filter((note) => note.slotId === slot.id),
              courtMatches,
            )}
            onGamePage
            className="mt-8 flex flex-col gap-4"
          />
          <CourtSuggestions
            matches={courtMatches}
            className="mt-8 flex flex-col gap-4"
          />
          <div className="mt-10 flex flex-col gap-8">
            <section>
              <h2 className="bb-h text-[1.05rem]">Your response</h2>
              <div className="bb-card mt-4 p-4 sm:p-6">
                <ResponseButtons
                  slotId={slot.id}
                  viewerId={session.userId}
                  viewerName={null}
                  initial={{ responses, myAnswer }}
                />
              </div>
            </section>
            <section>
              <h2 className="bb-h text-[1.05rem]">Capacity</h2>
              <div className="bb-card mt-4 p-4 sm:p-6">
                <SlotCapacityPanel
                  slotId={slot.id}
                  isOwner={isOwner}
                  capacity={capacity}
                  initial={{ responses, myAnswer }}
                />
              </div>
            </section>
            <section>
              <h2 className="bb-h text-[1.05rem]">Notes</h2>
              <div className="bb-card mt-4 p-4 sm:p-6">
                {isOwner ? (
                  <NotesForm slotId={slot.id} notes={notes} />
                ) : (
                  <p className="text-sm whitespace-pre-wrap">
                    {notes ?? (
                      <span className="text-muted-foreground">
                        No notes added yet.
                      </span>
                    )}
                  </p>
                )}
              </div>
            </section>
            {isOwner && (
              <section id="courts" className="scroll-mt-24">
                <h2 className="bb-h text-[1.05rem]">Courts</h2>
                <div className="bb-card mt-4 p-4 sm:p-6">
                  <SlotCourts
                    slotId={slot.id}
                    capacity={capacity}
                    orgs={ownedOrgs}
                  />
                </div>
              </section>
            )}
            {isOwner && (
              <section>
                <h2 className="bb-h text-[1.05rem]">Invite link</h2>
                <div className="bb-card mt-4 p-4 sm:p-6">
                  <SlotLinkPanel
                    slotId={slot.id}
                    slotLink={slotLink}
                    groupChat={{
                      initialResponses: { responses, myAnswer },
                      game: {
                        when: slot.when,
                        facilityLabel: slot.facilityLabel,
                        courtLabels: capacity.attached.map(
                          (booking) => booking.courtLabel,
                        ),
                        repeatsLabel: slot.repeatsLabel,
                      },
                    }}
                  />
                </div>
              </section>
            )}
            {isOwner && (
              <section>
                <h2 className="bb-h text-[1.05rem]">Reminder</h2>
                <div className="bb-card mt-4 p-4 sm:p-6">
                  <ReminderOffsetForm
                    slotId={slot.id}
                    reminderOffsetMinutes={reminderOffsetMinutes}
                  />
                </div>
              </section>
            )}
            {isOwner && (
              <section>
                <h2 className="bb-h text-[1.05rem]">Booking reminder</h2>
                <div className="bb-card mt-4 p-4 sm:p-6">
                  <IntendedOrgForm
                    slotId={slot.id}
                    orgs={ownedOrgs}
                    intendedOrgId={intendedOrgId}
                  />
                </div>
              </section>
            )}
            {isOwner && standingGameId && (
              <section>
                <h2 className="bb-h text-[1.05rem]">Skip this week</h2>
                <div className="bb-card mt-4 flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">
                    Can&apos;t play this week? Skip it and everyone who said
                    yes or maybe hears it&apos;s off.
                  </p>
                  <SkipWeekButton
                    slotId={slot.id}
                    when={slot.when}
                    notice={skipNotice}
                  />
                </div>
              </section>
            )}
            {weeklyPrefill && (
              <section>
                <h2 className="bb-h text-[1.05rem]">Make this weekly</h2>
                <div className="bb-card mt-4 flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">
                    Want this game every{" "}
                    {WEEKDAY_NAMES[weeklyPrefill.weekday]}? Set it up as a
                    weekly game, with the friends who said yes already picked
                    as regulars. This game stays as it is.
                  </p>
                  {/* A link styled as a button: it navigates, it doesn't act. */}
                  <Link
                    href={makeWeeklyHref(weeklyPrefill)}
                    className={cn(
                      buttonVariants({ variant: "outline" }),
                      "shrink-0 no-underline",
                    )}
                  >
                    Make this weekly
                  </Link>
                </div>
              </section>
            )}
            {isOwner && !standingGameId && (
              <section>
                <h2 className="bb-h text-[1.05rem]">Delete game</h2>
                <div className="bb-card mt-4 flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">
                    Withdraw this proposal for good. Anyone who&apos;s responded
                    loses their spot.
                  </p>
                  <DeleteSlotButton slotId={slot.id} when={slot.when} />
                </div>
              </section>
            )}
          </div>
          <BbFooter />
        </div>
      </section>
    </div>
  );
}
