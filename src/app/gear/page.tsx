import type { Metadata } from "next";

import { hosts, partnerCodes } from "@/data/gear";
import { pageMetadata } from "@/lib/metadata";
import { buildGearJsonLd, toJsonLdScript } from "@/lib/structured-data";
import { PageHead } from "@/components/bx/page-head";
import { HostGearSection } from "./sections/host-gear-section";
import { PartnerCodesSection } from "./sections/partner-codes-section";

export const metadata: Metadata = pageMetadata({
  title: "Gear",
  description:
    "The paddles, shoes, and accessories the Juice Bros actually play with, plus ambassador discount codes for our favorite gear.",
  path: "/gear",
});

/**
 * The gear page, in Broadcast Dark.
 *
 * The one page on the site where the visitor is looking at objects rather than
 * reading, so the products carry all the colour and the chrome gets out of the
 * way entirely: white plates, ink titles, and a metadata line each. See
 * `gear-card.tsx` for why the plate is white and why the discount code is not
 * orange.
 *
 * The disclosure is a plain sentence in the header rather than a boxed notice
 * at the bottom. It is a real commercial relationship and it belongs where
 * someone reads it before clicking, not underneath the thing it discloses.
 */
export default function GearPage() {
  return (
    <div className="flex w-full flex-1 flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toJsonLdScript(buildGearJsonLd(hosts, partnerCodes)) }}
      />

      <PageHead
        title="What we actually play with"
        lead="Our paddles, our grips, the stuff that ends up in the bag. Nothing here is on the list because a brand asked, and we've each got our own setup."
        note={
          <>
            Some links below are ambassador codes. They take a bit off your
            order and earn us a commission at no extra cost to you.
          </>
        }
      />

      <div className="bx-measure pb-6">
        {hosts.map((host, index) => (
          <HostGearSection key={host.name} host={host} first={index === 0} />
        ))}
        <PartnerCodesSection items={partnerCodes} />
      </div>
    </div>
  );
}
