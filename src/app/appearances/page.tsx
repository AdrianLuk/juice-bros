import type { Metadata } from "next";

import { appearances } from "@/content/appearances";
import { eventRecaps } from "@/content/event-recaps";
import { photoSets } from "@/content/photo-sets";
import { nextConfirmedAppearance, splitAppearances } from "@/lib/appearances";
import { pageMetadata } from "@/lib/metadata";
import { photoSetHrefsByAppearance } from "@/lib/photo-sets";
import { buildAppearancesJsonLd, toJsonLdScript } from "@/lib/structured-data";
import { PageHead } from "@/components/bx/page-head";
import { Picture } from "@/components/picture";
import { EventRecaps } from "./sections/event-recaps";
import { SpotUs } from "./sections/spot-us";
import { UpNext } from "./sections/up-next";
import { UpcomingAppearances } from "./sections/upcoming-appearances";
import { PastAppearances } from "./sections/past-appearances";

export const metadata: Metadata = pageMetadata({
  title: "Appearances",
  description:
    "Where to catch the Juice Bros in person. The pickleball tournaments Adrian and Daven are playing next, plus the ones already in the books.",
  path: "/appearances",
});

/**
 * Where to find the hosts in person, in Broadcast Dark.
 *
 * The next confirmed tournament takes the page's one band, and the rest of the
 * calendar follows as rows on the page ground - see `up-next.tsx` for why this
 * page features its first entry when the Podcast catalogue deliberately does
 * not. A tentative entry never gets the band: it is a plan, not a place to
 * turn up, and promoting it would make the page's most prominent claim its
 * least reliable one.
 */
export default function AppearancesPage() {
  const { upcoming, past } = splitAppearances(appearances);
  const featured = nextConfirmedAppearance(appearances);
  const rest = featured ? upcoming.filter((entry) => entry !== featured) : upcoming;
  const photoSetHrefs = photoSetHrefsByAppearance(photoSets, past);

  return (
    <div className="flex w-full flex-1 flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toJsonLdScript(buildAppearancesJsonLd(appearances)) }}
      />

      <PageHead
        title="Where to catch us in person"
        // The count alone. An earlier draft added "Ontario and around", which
        // was one word wider than the truth - every entry on the calendar is
        // in Ontario.
        meta={upcoming.length > 0 ? `${upcoming.length} coming up` : undefined}
        lead="The tournaments we're actually signed up for, with the brackets we're in. If you're playing one of these, come say hi between matches."
        // Adrian's name across his back as they shake hands at the net: the
        // view from the rail, and exactly what someone looking for them at a
        // venue will see. A camera original from Creator Night.
        media={
          <figure className="bx-tile aspect-4/3">
            <Picture
              src="/pictures/creator-night-adrian-daven-net-handshake.jpg"
              alt="Adrian and Daven shaking hands at the net after a game, Adrian's name across the back of his shirt"
              sizes="(min-width: 1024px) 30rem, 100vw"
              fetchPriority="high"
              className="object-[50%_62%]"
            />
          </figure>
        }
      />

      {featured && <UpNext appearance={featured} />}

      <div className="bx-measure pb-6">
        <UpcomingAppearances appearances={rest} standalone={!featured} />
        <SpotUs />
        <EventRecaps recaps={eventRecaps} />
        <PastAppearances appearances={past} photoSetHrefs={photoSetHrefs} />
      </div>
    </div>
  );
}
