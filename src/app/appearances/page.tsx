import type { Metadata } from "next";

import { appearances } from "@/content/appearances";
import { splitAppearances } from "@/lib/appearances";
import { pageMetadata } from "@/lib/metadata";
import { buildAppearancesJsonLd, toJsonLdScript } from "@/lib/structured-data";
import { Reveal } from "@/components/motion/reveal";
import { PageHeading } from "@/components/typography/page-heading";
import { UpcomingAppearances } from "./sections/upcoming-appearances";
import { PastAppearances } from "./sections/past-appearances";

export const metadata: Metadata = pageMetadata({
  title: "Appearances",
  description:
    "Where to catch the Juice Bros in person. The pickleball tournaments Adrian and Daven are playing next, plus the ones already in the books.",
  path: "/appearances",
});

export default function AppearancesPage() {
  const { upcoming, past } = splitAppearances(appearances);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-20 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toJsonLdScript(buildAppearancesJsonLd(appearances)) }}
      />
      <PageHeading
        eyebrow="In The Wild"
        title="Appearances"
        description="Where to catch us in person. If you're playing one of these tournaments, come say hi."
      />

      <Reveal>
        <UpcomingAppearances appearances={upcoming} />
      </Reveal>
      <Reveal>
        <PastAppearances appearances={past} />
      </Reveal>
    </div>
  );
}
