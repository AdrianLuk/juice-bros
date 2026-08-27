import type { Metadata } from "next";
import Link from "next/link";

import { pageMetadata } from "@/lib/metadata";
import { PageHeading } from "@/components/typography/page-heading";
import { BbSectionNav } from "@/components/booking-buddy/bb-section-nav";
import { CreateSlotForm, SlotRow } from "@/components/booking-buddy/slots";
import { BbFooter } from "@/components/booking-buddy/bb-footer";
import { verifySession } from "@/lib/booking-buddy/dal";
import { listSlots } from "@/lib/booking-buddy/actions/slots";
import { listOrgs } from "@/lib/booking-buddy/actions/orgs";
import { slotPath } from "@/lib/booking-buddy/routes";

export const metadata: Metadata = pageMetadata({
  title: "Games",
  description:
    "Post open time and gauge interest before you reserve a court, or see what your friends have proposed.",
  path: "/booking-buddy/slots",
});

export default async function SlotsPage() {
  // Authoritative check. The proxy already bounced signed-out visitors, but
  // that check is optimistic and must not be relied on alone.
  await verifySession();

  const [{ own, friends }, orgs] = await Promise.all([listSlots(), listOrgs()]);

  return (
    <div className="flex w-full flex-1 flex-col">
      <section className="w-full px-4 pt-6 pb-16 sm:px-6 sm:pt-16 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <PageHeading
            eyebrow="Booking Buddy"
            title="Games"
            description="Propose a time before you've reserved a court. Friends respond yes, no, or maybe."
          />
          <BbSectionNav />

          <div className="mt-10 flex flex-col gap-12">
            <section>
              <h2 className="font-heading text-lg font-semibold tracking-tight">
                Your games
              </h2>
              {own.length === 0 ? (
                <p className="mt-4 rounded-xl border border-dashed border-muted-foreground/25 bg-muted/30 p-4 text-sm text-muted-foreground">
                  Proposed times live here. Post one below and friends reply
                  yes, no, or maybe, before anyone books a court.
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
                  Nothing here yet. This fills up once a friend with{" "}
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
                Post a game
              </h2>
              <div className="mt-4">
                <CreateSlotForm orgs={orgs} />
              </div>
            </section>
          </div>

          <BbFooter />
        </div>
      </section>
    </div>
  );
}
