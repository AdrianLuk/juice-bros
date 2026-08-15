import type { Metadata } from "next";
import Link from "next/link";

import { pageMetadata } from "@/lib/metadata";
import { PageHeading } from "@/components/typography/page-heading";
import { CreateOrgForm, OrgRow } from "@/components/booking-buddy/orgs";
import { verifySession } from "@/lib/booking-buddy/dal";
import { listOrgs } from "@/lib/booking-buddy/actions/orgs";
import { BOOKINGS_PATH, BOOKING_BUDDY_ROOT } from "@/lib/booking-buddy/routes";

export const metadata: Metadata = pageMetadata({
  title: "Where you play",
  description:
    "Keep the clubs and courts you play at in one place, so your bookings have somewhere to hang off.",
  path: "/booking-buddy/orgs",
});

export default async function OrgsPage() {
  // Authoritative check. The proxy already bounced signed-out visitors, but
  // that check is optimistic and must not be relied on alone.
  await verifySession();

  const orgs = await listOrgs();

  return (
    <div className="flex w-full flex-1 flex-col">
      <section className="w-full px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <PageHeading
            eyebrow="Booking Buddy"
            title="Where you play"
            description="The clubs and courts you book at. Only you can see this list."
          />

          <div className="mt-10 flex flex-col gap-12">
            <section>
              <h2 className="font-heading text-lg font-semibold tracking-tight">
                Add a place
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Type the name for now. Searching for your club by name is coming
                — until then this is the way in, and it&apos;s the permanent one
                for courts nobody has listed.
              </p>
              <div className="mt-4">
                <CreateOrgForm />
              </div>
            </section>

            <section>
              <h2 className="font-heading text-lg font-semibold tracking-tight">
                Your places
                {orgs.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    {orgs.length}
                  </span>
                )}
              </h2>

              {orgs.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  Nothing here yet. Add the club you play at and you can start
                  logging court bookings.
                </p>
              ) : (
                <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
                  {orgs.map((org) => (
                    <OrgRow key={org.id} org={org} />
                  ))}
                </ul>
              )}
            </section>
          </div>

          <p className="mt-14 flex gap-4 text-sm">
            <Link href={BOOKINGS_PATH} className="underline underline-offset-4">
              Your bookings
            </Link>
            <Link
              href={BOOKING_BUDDY_ROOT}
              className="underline underline-offset-4"
            >
              Back to Booking Buddy
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
