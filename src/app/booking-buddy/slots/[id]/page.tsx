import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { pageMetadata } from "@/lib/metadata";
import { BbPageHeading } from "@/components/booking-buddy/bb/page-heading";
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
import { verifySession } from "@/lib/booking-buddy/dal";
import { getSlotDetail } from "@/lib/booking-buddy/actions/slots";
import { getSlotLink } from "@/lib/booking-buddy/actions/slot-links";
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
  } = detail;
  const slotLink = isOwner ? await getSlotLink(slot.id) : null;
  return (
    <div className="flex w-full flex-1 flex-col">
      <section className="w-full px-4 pt-6 pb-16 sm:px-6 sm:pt-16 lg:px-8">
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
          </div>
          <div className="mt-10 flex flex-col gap-8">
            <section>
              <h2 className="bb-h text-[1.05rem]">Your response</h2>
              <div className="bb-card mt-4 p-6">
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
              <div className="bb-card mt-4 p-6">
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
              <div className="bb-card mt-4 p-6">
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
              <section>
                <h2 className="bb-h text-[1.05rem]">Courts</h2>
                <div className="bb-card mt-4 p-6">
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
                <div className="bb-card mt-4 p-6">
                  <SlotLinkPanel slotId={slot.id} slotLink={slotLink} />
                </div>
              </section>
            )}
            {isOwner && (
              <section>
                <h2 className="bb-h text-[1.05rem]">Reminder</h2>
                <div className="bb-card mt-4 p-6">
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
                <div className="bb-card mt-4 p-6">
                  <IntendedOrgForm
                    slotId={slot.id}
                    orgs={ownedOrgs}
                    intendedOrgId={intendedOrgId}
                  />
                </div>
              </section>
            )}
            {isOwner && (
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
