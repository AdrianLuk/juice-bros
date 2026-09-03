import type { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";
import {
  AVAILABILITY_PATH,
  BOOKINGS_PATH,
  FRIENDS_PATH,
  GROUPS_PATH,
  JOIN_PATH,
  ORGS_PATH,
  OVERLAP_PATH,
  SETTINGS_PATH,
  SLOTS_PATH,
  SLOT_LINK_ROOT,
} from "@/lib/booking-buddy/routes";
import { ON_DECK_HOME_PATH, ON_DECK_ROOT } from "@/lib/on-deck/routes";

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
        AVAILABILITY_PATH,
        OVERLAP_PATH,
        SETTINGS_PATH,
        `${JOIN_PATH}/`,
        `${SLOT_LINK_ROOT}/`,
        // On Deck: the /on-deck landing page stays crawlable; the Organizer
        // home, the QR resolver, the live Session view, and the gated dev
        // console do not — they redirect, gate, 404, or are a live-event
        // surface, not a page.
        ON_DECK_HOME_PATH,
        `${ON_DECK_ROOT}/c/`,
        `${ON_DECK_ROOT}/session/`,
        `${ON_DECK_ROOT}/dev`,
      ],
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
