import type { Metadata } from "next";

import { PageHeading } from "@/components/typography/page-heading";
import { Intro } from "./sections/intro";
import { OriginEpisode } from "./sections/origin-episode";

export const metadata: Metadata = {
  title: "About",
};

export default function AboutPage() {
  return (
    <div className="flex w-full flex-1 flex-col px-4 py-16 sm:px-6 lg:px-8">
      <PageHeading eyebrow="Who We Are" title="About Juice Bros Pickleball" />

      <Intro />
      <OriginEpisode />
    </div>
  );
}
