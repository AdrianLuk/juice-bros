import type { Metadata } from "next";

import { pageMetadata } from "@/lib/metadata";
import { PageHeading } from "@/components/typography/page-heading";
import { BbSectionNav } from "@/components/booking-buddy/bb-section-nav";
import { GroupOverlapFinder } from "@/components/booking-buddy/group-overlap-finder";
import { BbFooter } from "@/components/booking-buddy/bb-footer";
import { verifySession } from "@/lib/booking-buddy/dal";
import { getOverlapPageData } from "@/lib/booking-buddy/actions/overlap";

export const metadata: Metadata = pageMetadata({
  title: "Find a time",
  description:
    "Pick a few friends and see the days and times you're all free, then propose a game for one.",
  path: "/booking-buddy/overlap",
});

export default async function OverlapPage() {
  // Authoritative check. The proxy already bounced signed-out visitors, but
  // that check is optimistic and must not be relied on alone.
  await verifySession();

  const { selectableFriends, viewerBusy, viewerWindows } =
    await getOverlapPageData();

  return (
    <div className="flex w-full flex-1 flex-col">
      <section className="w-full px-4 pt-6 pb-16 sm:px-6 sm:pt-16 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <PageHeading
            eyebrow="Booking Buddy"
            title="Find a time"
            description="Pick the friends you want to play with and see when you're all free. It only counts time nobody's booked and nobody's marked busy."
          />
          <BbSectionNav />

          <div className="mt-10">
            <GroupOverlapFinder
              friends={selectableFriends}
              viewerBusy={viewerBusy}
              viewerWindows={viewerWindows}
            />
          </div>

          <BbFooter />
        </div>
      </section>
    </div>
  );
}
