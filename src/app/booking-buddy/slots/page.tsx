import type { Metadata } from "next";
import Link from "next/link";

import { pageMetadata } from "@/lib/metadata";
import { PageHeading } from "@/components/typography/page-heading";
import { BookingBuddyNav } from "@/components/booking-buddy/bb-nav";
import { CreateSlotForm, SlotRow } from "@/components/booking-buddy/slots";
import { FooterNav, FooterLink } from "@/components/booking-buddy/footer-nav";
import { verifySession } from "@/lib/booking-buddy/dal";
import { listSlots } from "@/lib/booking-buddy/actions/slots";
import { BOOKING_BUDDY_ROOT, PRIVACY_PATH, slotPath } from "@/lib/booking-buddy/routes";

export const metadata: Metadata = pageMetadata({
  title: "Slots",
  description:
    "Post open time and gauge interest before you reserve a court, or see what your friends have proposed.",
  path: "/booking-buddy/slots",
});

export default async function SlotsPage() {
  // Authoritative check. The proxy already bounced signed-out visitors, but
  // that check is optimistic and must not be relied on alone.
  await verifySession();

  const { own, friends } = await listSlots();

  return (
    <div className="flex w-full flex-1 flex-col">
      <section className="w-full px-4 pt-6 pb-16 sm:px-6 sm:pt-16 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="flex flex-col-reverse gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-x-8 sm:gap-y-4">
            <div>
              <PageHeading
                eyebrow="Booking Buddy"
                title="Slots"
                description="Propose a time before you've reserved a court — friends respond yes, no, or maybe, same as a poll."
              />
            </div>

            <BookingBuddyNav current="slots" />
          </div>

          <div className="mt-10 flex flex-col gap-12">
            <section>
              <h2 className="font-heading text-lg font-semibold tracking-tight">
                Your slots
              </h2>
              {own.length === 0 ? (
                <p className="mt-4 rounded-xl border border-dashed border-muted-foreground/25 bg-muted/30 p-4 text-sm text-muted-foreground">
                  Nothing posted yet.
                </p>
              ) : (
                <ul className="mt-4 divide-y divide-border/60 overflow-hidden bb-card">
                  {own.map((slot) => (
                    <SlotRow key={slot.id} slot={slot} href={slotPath(slot.id)} />
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h2 className="font-heading text-lg font-semibold tracking-tight">
                From your friends
              </h2>
              {friends.length === 0 ? (
                <p className="mt-4 rounded-xl border border-dashed border-muted-foreground/25 bg-muted/30 p-4 text-sm text-muted-foreground">
                  Nothing here yet — this fills up once a friend with{" "}
                  <Link href="/booking-buddy/groups" className="underline underline-offset-4">
                    Slot Visibility into you
                  </Link>{" "}
                  posts one, or once you have that into them.
                </p>
              ) : (
                <ul className="mt-4 divide-y divide-border/60 overflow-hidden bb-card">
                  {friends.map((slot) => (
                    <SlotRow key={slot.id} slot={slot} href={slotPath(slot.id)} />
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h2 className="font-heading text-lg font-semibold tracking-tight">
                Post a slot
              </h2>
              <div className="mt-4">
                <CreateSlotForm />
              </div>
            </section>
          </div>

          <FooterNav>
            <FooterLink href={PRIVACY_PATH}>Privacy</FooterLink>
            <FooterLink href={BOOKING_BUDDY_ROOT} back>
              Back to Booking Buddy
            </FooterLink>
          </FooterNav>
        </div>
      </section>
    </div>
  );
}
