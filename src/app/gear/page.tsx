import type { Metadata } from "next";

import { hosts, partnerCodes } from "@/data/gear";
import { pageMetadata } from "@/lib/metadata";
import { buildGearJsonLd, toJsonLdScript } from "@/lib/structured-data";
import { Reveal } from "@/components/motion/reveal";
import { PageHeading } from "@/components/typography/page-heading";
import { HostGearSection } from "./sections/host-gear-section";
import { PartnerCodesSection } from "./sections/partner-codes-section";

export const metadata: Metadata = pageMetadata({
  title: "Gear",
  description:
    "The paddles, shoes, and accessories the Juice Bros actually play with, plus ambassador discount codes for our favorite gear.",
  path: "/gear",
});

export default function GearPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-20 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toJsonLdScript(buildGearJsonLd(hosts, partnerCodes)) }}
      />
      <PageHeading
        eyebrow="What We Play With"
        title="Gear"
        description="The paddles, apparel, and accessories we actually use - plus our ambassador codes for a discount. We only share products we genuinely play with and believe in."
      />
      <p className="mt-3 max-w-xl text-sm text-muted-foreground">
        Affiliate disclosure: some links below are ambassador codes that earn us a
        commission at no extra cost to you.
      </p>

      {hosts.map((host) => (
        <Reveal key={host.name}>
          <HostGearSection host={host} />
        </Reveal>
      ))}

      <Reveal>
        <PartnerCodesSection items={partnerCodes} />
      </Reveal>
    </div>
  );
}
