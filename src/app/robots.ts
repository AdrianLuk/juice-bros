import type { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      // Booking Buddy is an unlaunched, invite-only app: keep its account-gated
      // routes and guest Slot Links out of the index, but leave the privacy
      // policy crawlable (Google's OAuth review needs a reachable copy). Listed
      // before the disallows so first-match crawlers honour the exception too.
      allow: ["/", "/booking-buddy/privacy"],
      disallow: ["/booking-buddy", "/s/"],
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
