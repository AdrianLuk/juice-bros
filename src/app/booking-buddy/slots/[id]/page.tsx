import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { pageMetadata } from "@/lib/metadata";
import { PageHeading } from "@/components/typography/page-heading";
import {
  ResponseButtons,
  SlotCapacityPanel,
  SlotCourts,
} from "@/components/booking-buddy/slots";
import { SlotLinkPanel } from "@/components/booking-buddy/slot-links";
import { ReminderOffsetForm } from "@/components/booking-buddy/reminders";
import { IntendedOrgForm } from "@/components/booking-buddy/booking-window";
import { FooterNav, FooterLink } from "@/components/booking-buddy/footer-nav";
import { verifySession } from "@/lib/booking-buddy/dal";
import { getSlotDetail } from "@/lib/booking-buddy/actions/slots";
import { getSlotLink } from "@/lib/booking-buddy/actions/slot-links";
import { SLOTS_PATH } from "@/lib/booking-buddy/routes";

export const metadata: Metadata = pageMetadata({
  title: "Slot",
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
  } = detail;
  const slotLink = isOwner ? await getSlotLink(slot.id) : null;

  return (
    <div className="flex w-full flex-1 flex-col">
      <section className="w-full px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <PageHeading
            eyebrow="Booking Buddy"
            title={slot.when}
            description={
              isOwner ? "Proposed by you" : `Proposed by ${slot.ownerName}`
            }
          />

          <div className="mt-10 flex flex-col gap-8">
            <section>
              <h2 className="font-heading text-lg font-semibold tracking-tight">
                Your response
              </h2>
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
              <h2 className="font-heading text-lg font-semibold tracking-tight">
                Capacity
              </h2>
              <div className="bb-card mt-4 p-6">
                <SlotCapacityPanel
                  slotId={slot.id}
                  isOwner={isOwner}
                  capacity={capacity}
                  initial={{ responses, myAnswer }}
                />
              </div>
            </section>

            {isOwner && (
              <section>
                <h2 className="font-heading text-lg font-semibold tracking-tight">
                  Courts
                </h2>
                <div className="bb-card mt-4 p-6">
                  <SlotCourts slotId={slot.id} capacity={capacity} />
                </div>
              </section>
            )}

            {isOwner && (
              <section>
                <h2 className="font-heading text-lg font-semibold tracking-tight">
                  Invite link
                </h2>
                <div className="bb-card mt-4 p-6">
                  <SlotLinkPanel slotId={slot.id} slotLink={slotLink} />
                </div>
              </section>
            )}

            {isOwner && (
              <section>
                <h2 className="font-heading text-lg font-semibold tracking-tight">
                  Reminder
                </h2>
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
                <h2 className="font-heading text-lg font-semibold tracking-tight">
                  Booking reminder
                </h2>
                <div className="bb-card mt-4 p-6">
                  <IntendedOrgForm
                    slotId={slot.id}
                    orgs={ownedOrgs}
                    intendedOrgId={intendedOrgId}
                  />
                </div>
              </section>
            )}
          </div>

          <FooterNav>
            <FooterLink href={SLOTS_PATH} back>
              Back to slots
            </FooterLink>
          </FooterNav>
        </div>
      </section>
    </div>
  );
}
