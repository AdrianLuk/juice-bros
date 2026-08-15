import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { pageMetadata } from "@/lib/metadata";
import { PageHeading } from "@/components/typography/page-heading";
import { ResponseButtons } from "@/components/booking-buddy/slots";
import { verifySession } from "@/lib/booking-buddy/dal";
import { getSlotDetail } from "@/lib/booking-buddy/actions/slots";
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

  const { slot, isOwner, responses, myAnswer } = detail;

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

          <section className="mt-10">
            <h2 className="font-heading text-lg font-semibold tracking-tight">
              Your response
            </h2>
            <div className="mt-4">
              <ResponseButtons
                slotId={slot.id}
                viewerId={session.userId}
                viewerName={null}
                initial={{ responses, myAnswer }}
              />
            </div>
          </section>

          <p className="mt-14">
            <Link href={SLOTS_PATH} className="text-sm underline underline-offset-4">
              Back to slots
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
