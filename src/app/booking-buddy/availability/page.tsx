import type { Metadata } from "next";
import { ChevronDownIcon } from "lucide-react";

import { pageMetadata } from "@/lib/metadata";
import { PageHeading } from "@/components/typography/page-heading";
import { BbSectionNav } from "@/components/booking-buddy/bb-section-nav";
import {
  AvailabilityWindowRow,
  CreateAvailabilityWindowForm,
} from "@/components/booking-buddy/availability";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { BbFooter } from "@/components/booking-buddy/bb-footer";
import { verifySession } from "@/lib/booking-buddy/dal";
import { listAvailabilityWindows } from "@/lib/booking-buddy/actions/availability";
import { formatAvailabilityWindowRange } from "@/lib/booking-buddy/availability";
import { DEFAULT_HAND_NAMED_TIME_ZONE } from "@/lib/booking-buddy/orgs";

export const metadata: Metadata = pageMetadata({
  title: "Open time",
  description:
    "Block off the stretches you're open or busy, so friends know when to catch you for a game.",
  path: "/booking-buddy/availability",
});

export default async function AvailabilityPage() {
  // Authoritative check. The proxy already bounced signed-out visitors, but
  // that check is optimistic and must not be relied on alone.
  await verifySession();

  const windows = await listAvailabilityWindows();

  // `endsAt`, not `startsAt`: a window straddling now (started yesterday, still
  // running) is still current and belongs with the upcoming ones — same
  // "any overlap counts" split the Bookings page uses (`notEndedBefore`).
  const nowMs = new Date().getTime();
  const upcoming = windows
    .filter((window) => new Date(window.endsAt).getTime() > nowMs)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  const past = windows
    .filter((window) => new Date(window.endsAt).getTime() <= nowMs)
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());

  return (
    <div className="flex w-full flex-1 flex-col">
      <section className="w-full px-4 pt-6 pb-16 sm:px-6 sm:pt-16 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <PageHeading
            eyebrow="Booking Buddy"
            title="Open time"
            description="Mark when you're open or busy. It only shows on your calendar, and never blocks a game invite."
          />
          <BbSectionNav />

          <div className="mt-10 flex flex-col gap-12">
            <section>
              <h2 className="font-heading text-lg font-semibold tracking-tight">
                Your availability blocks
                {upcoming.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    {upcoming.length}
                  </span>
                )}
              </h2>

              {upcoming.length === 0 ? (
                <p className="mt-4 rounded-xl border border-dashed border-muted-foreground/25 bg-muted/30 p-4 text-sm text-muted-foreground">
                  Nothing upcoming. Block off a stretch below
                  {past.length > 0 ? ", or check History for past ones." : "."}
                </p>
              ) : (
                <ul className="mt-4 flex flex-col gap-2">
                  {upcoming.map((window) => (
                    <AvailabilityWindowRow
                      key={window.id}
                      window={window}
                      rangeLabel={formatAvailabilityWindowRange(
                        window,
                        DEFAULT_HAND_NAMED_TIME_ZONE,
                      )}
                    />
                  ))}
                </ul>
              )}

              {past.length > 0 && (
                <Collapsible className="mt-6">
                  <CollapsibleTrigger className="group flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
                    <ChevronDownIcon className="size-4 transition-transform duration-200 group-data-panel-open:rotate-180" />
                    History
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <ul className="mt-4 flex flex-col gap-2">
                      {past.map((window) => (
                        <AvailabilityWindowRow
                          key={window.id}
                          window={window}
                          rangeLabel={formatAvailabilityWindowRange(
                            window,
                            DEFAULT_HAND_NAMED_TIME_ZONE,
                          )}
                        />
                      ))}
                    </ul>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </section>

            <section>
              <h2 className="font-heading text-lg font-semibold tracking-tight">
                Block off time
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Mark a stretch as open or busy. Friends can still ask about it,
                this doesn&apos;t stop a game invite.
              </p>
              <div className="mt-4">
                <CreateAvailabilityWindowForm />
              </div>
            </section>
          </div>

          <BbFooter />
        </div>
      </section>
    </div>
  );
}
