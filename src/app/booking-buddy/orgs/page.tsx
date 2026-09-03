import type { Metadata } from "next";
import { ChevronDownIcon } from "lucide-react";
import { pageMetadata } from "@/lib/metadata";
import { BbPageHeading } from "@/components/booking-buddy/bb/page-heading";
import { BbSectionNav } from "@/components/booking-buddy/bb-section-nav";
import { CreateOrgForm, OrgRow } from "@/components/booking-buddy/orgs";
import { SearchPlaceForm } from "@/components/booking-buddy/place-search";
import { BbFooter } from "@/components/booking-buddy/bb-footer";
import { verifySession } from "@/lib/booking-buddy/dal";
import { listOrgs } from "@/lib/booking-buddy/actions/orgs";
export const metadata: Metadata = pageMetadata({
  title: "Facilities",
  description:
    "Keep the facilities you play at in one place, so your bookings have somewhere to hang off.",
  path: "/booking-buddy/orgs",
});
export default async function OrgsPage() {
  // Authoritative check. The proxy already bounced signed-out visitors, but
  // that check is optimistic and must not be relied on alone.
  await verifySession();
  // `listOrgs` returns newest-first; float the default facility to the top so
  // the one that pre-fills every Booking form is the first thing you see. The
  // sort is stable, so the rest stay in newest-first order.
  const orgs = [...(await listOrgs())].sort(
    (a, b) => Number(b.isDefault) - Number(a.isDefault),
  );
  return (
    <div className="flex w-full flex-1 flex-col">
      <section className="w-full px-4 pt-6 pb-16 sm:px-6 sm:pt-16 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <BbPageHeading
            title="Facilities"
            description="The facilities you book at. Only you can see this list."
          />
          <BbSectionNav />
          <div className="mt-10 flex flex-col gap-12">
            <section>
              <h2 className="bb-h text-[1.05rem]">Add a facility</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Search for your facility and pick it from Google&apos;s listing.
              </p>
              <div className="mt-4">
                <SearchPlaceForm />
              </div>
              <details className="group mt-6 overflow-hidden bb-card">
                <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-medium transition-colors hover:bg-muted">
                  Can&apos;t find your facility?
                  <ChevronDownIcon className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <div className="border-t border-border px-4 py-4">
                  <p className="text-sm text-muted-foreground">
                    Community-centre gyms and private courts usually aren&apos;t
                    on Google. Type the name instead. This is the permanent way
                    in for those.
                  </p>
                  <div className="mt-4">
                    <CreateOrgForm />
                  </div>
                </div>
              </details>
            </section>
            <section>
              <h2 className="bb-h text-[1.05rem]">
                Your facilities
                {orgs.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    {orgs.length}
                  </span>
                )}
              </h2>
              {orgs.length === 0 ? (
                <p className="mt-4 rounded-xl border border-dashed border-muted-foreground/25 bg-muted/30 p-4 text-sm text-muted-foreground">
                  Nothing here yet. Add a facility you play at and you can start
                  logging court bookings.
                </p>
              ) : (
                <ul className="mt-4 divide-y divide-border/60 overflow-hidden bb-card">
                  {orgs.map((org) => (
                    <OrgRow key={org.id} org={org} />
                  ))}
                </ul>
              )}
            </section>
          </div>
          <BbFooter />
        </div>
      </section>
    </div>
  );
}
