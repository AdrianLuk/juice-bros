import type { Metadata } from "next";

import { hosts, partnerCodes } from "@/data/gear";
import { pageMetadata } from "@/lib/metadata";
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
    <div className="flex w-full flex-1 flex-col px-4 py-16 sm:px-6 lg:px-8">
      <PageHeading
        eyebrow="What We Play With"
        title="Gear"
        description="The paddles, apparel, and accessories we actually use - plus our ambassador codes for a discount. We only share products we genuinely play with and believe in."
      />

      {hosts.map((host) => (
        <HostGearSection key={host.name} host={host} />
      ))}

      <PartnerCodesSection items={partnerCodes} />

      <p className="mt-16 text-xs text-muted-foreground">
        Affiliate disclosure: some products featured have ambassador discount codes
        available. We only share products we genuinely use and believe in.
      </p>
    </div>
  );
}
