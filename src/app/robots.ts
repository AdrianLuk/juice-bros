import type { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";
import {
  BOOKINGS_PATH,
  FRIENDS_PATH,
  GROUPS_PATH,
  JOIN_PATH,
  ORGS_PATH,
  SETTINGS_PATH,
  SLOTS_PATH,
  SLOT_LINK_ROOT,
} from "@/lib/booking-buddy/routes";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Booking Buddy's public pages (/booking-buddy landing, its sign-in and
      // privacy pages) stay crawlable; its signed-in-only feature routes, the
      // tokenised guest Slot Links, and the personal invite links do not -
      // they're private and, for a crawler, either redirect to sign-in or are
      // one person's link, not a page.
      disallow: [
        FRIENDS_PATH,
        GROUPS_PATH,
        ORGS_PATH,
        BOOKINGS_PATH,
        SLOTS_PATH,
        SETTINGS_PATH,
        `${JOIN_PATH}/`,
        `${SLOT_LINK_ROOT}/`,
      ],
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
