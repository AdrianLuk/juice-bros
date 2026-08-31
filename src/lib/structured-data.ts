import { siteConfig } from "@/config/site";
import type { Episode } from "@/lib/episodes";
import type { Appearance } from "@/lib/appearances";
import { confirmedUpcomingEvents } from "@/lib/appearances";
import type { GearItem, HostGear } from "@/data/gear";
import { apps, type AppItem } from "@/data/apps";
import type { Faq } from "@/lib/booking-buddy/landing-faqs";

/**
 * JSON.stringify doesn't escape "<", so a literal "</script>" inside a
 * string value (e.g. a YouTube-sourced episode title/description) would
 * otherwise close the inline <script> tag early and let the rest of the
 * payload be parsed as HTML. Escaping "<" to its unicode form is the
 * standard mitigation and is a no-op for valid JSON structure.
 */
export function toJsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function buildOrganizationJsonLd() {
  const sameAs = Object.values(siteConfig.links);
  const logo = `${siteConfig.url}/brand/JB_Logo_whitebg.jpeg`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteConfig.url}/#organization`,
        name: siteConfig.name,
        url: siteConfig.url,
        logo,
        sameAs,
      },
      {
        "@type": "WebSite",
        "@id": `${siteConfig.url}/#website`,
        url: siteConfig.url,
        name: siteConfig.name,
        publisher: { "@id": `${siteConfig.url}/#organization` },
      },
      {
        "@type": "PodcastSeries",
        "@id": `${siteConfig.url}/#podcast`,
        name: siteConfig.name,
        url: `${siteConfig.url}/podcast`,
        description: siteConfig.description,
        image: `${siteConfig.url}${siteConfig.ogImage}`,
        sameAs,
      },
    ],
  };
}

/**
 * PodcastEpisode + VideoObject + BreadcrumbList for one episode page. The
 * VideoObject is nested as the PodcastEpisode's associatedMedia rather than
 * a separate top-level node - it describes the same YouTube video, not an
 * independent asset.
 */
export function buildEpisodeJsonLd(episode: Episode) {
  const episodeUrl = `${siteConfig.url}/podcast/${episode.slug}`;
  const description = episode.description || episode.title;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: siteConfig.url },
          {
            "@type": "ListItem",
            position: 2,
            name: "Podcast",
            item: `${siteConfig.url}/podcast`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: episode.title,
            item: episodeUrl,
          },
        ],
      },
      {
        "@type": "PodcastEpisode",
        "@id": `${episodeUrl}#episode`,
        url: episodeUrl,
        name: episode.title,
        description,
        datePublished: episode.published,
        partOfSeries: { "@id": `${siteConfig.url}/#podcast` },
        associatedMedia: {
          "@type": "VideoObject",
          "@id": `${episodeUrl}#video`,
          name: episode.title,
          description,
          thumbnailUrl: [episode.thumbnail],
          uploadDate: episode.published,
          duration: episode.duration,
          embedUrl: `https://www.youtube.com/embed/${episode.id}`,
          contentUrl: episode.url,
        },
      },
    ],
  };
}

/**
 * BreadcrumbList + ItemList of episode links for the /podcast index. Each
 * entry just points at the episode's own page - the full PodcastEpisode
 * description already lives in buildEpisodeJsonLd there, no need to repeat it.
 */
export function buildPodcastListJsonLd(episodes: Episode[]) {
  const podcastUrl = `${siteConfig.url}/podcast`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: siteConfig.url },
          { "@type": "ListItem", position: 2, name: "Podcast", item: podcastUrl },
        ],
      },
      {
        "@type": "ItemList",
        "@id": `${podcastUrl}#items`,
        itemListElement: episodes.map((episode, index) => ({
          "@type": "ListItem",
          position: index + 1,
          url: `${podcastUrl}/${episode.slug}`,
          name: episode.title,
        })),
      },
    ],
  };
}

/**
 * BreadcrumbList + ItemList of Product entries for the Gear page. Deliberately
 * omits `offers` (price/availability) - these are external affiliate links
 * whose pricing we don't control, and stale price data risks a Search Console
 * structured-data penalty.
 */
export function buildGearJsonLd(hosts: HostGear[], partnerCodes: GearItem[]) {
  const gearUrl = `${siteConfig.url}/gear`;
  const seen = new Set<string>();
  const items = [...hosts.flatMap((host) => host.current), ...partnerCodes].filter((item) => {
    if (seen.has(item.name)) return false;
    seen.add(item.name);
    return true;
  });

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: siteConfig.url },
          { "@type": "ListItem", position: 2, name: "Gear", item: gearUrl },
        ],
      },
      {
        "@type": "ItemList",
        "@id": `${gearUrl}#items`,
        itemListElement: items.map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          item: {
            "@type": "Product",
            name: item.name,
            category: item.category,
            description: item.blurb,
            image: item.image,
            url: item.url,
          },
        })),
      },
    ],
  };
}

/**
 * BreadcrumbList for the /appearances page plus one `Event` node per confirmed
 * upcoming appearance (see `confirmedUpcomingEvents`). Tentative and past
 * appearances are deliberately left out - Google penalizes speculative or
 * stale event markup. Returns just the breadcrumb when nothing confirmed is
 * upcoming.
 */
export function buildAppearancesJsonLd(list: readonly Appearance[], now: Date = new Date()) {
  const appearancesUrl = `${siteConfig.url}/appearances`;
  const events = confirmedUpcomingEvents(list, now);

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: siteConfig.url },
          { "@type": "ListItem", position: 2, name: "Appearances", item: appearancesUrl },
        ],
      },
      ...events,
    ],
  };
}

/**
 * The shared shape of a SoftwareApplication node, used both for the /tools
 * apps and for standalone app pages that have no `apps.ts` entry yet. `free`
 * attaches a zero-price Offer; `publisher` links back to the Organization
 * node (only worth doing when the node stands alone, not inside the Tools
 * ItemList where the page already carries the Organization).
 */
function softwareApplicationNode({
  id,
  name,
  description,
  url,
  free = true,
  publisher = false,
}: {
  id: string;
  name: string;
  description: string;
  url: string;
  free?: boolean;
  publisher?: boolean;
}) {
  return {
    "@type": "SoftwareApplication",
    "@id": id,
    name,
    description,
    url,
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Web",
    ...(free ? { offers: { "@type": "Offer", price: "0", priceCurrency: "USD" } } : {}),
    ...(publisher ? { publisher: { "@id": `${siteConfig.url}/#organization` } } : {}),
  };
}

function buildSoftwareApplicationJsonLd(app: AppItem) {
  return softwareApplicationNode({
    id: `${siteConfig.url}${app.href}#app`,
    name: app.title,
    description: app.description,
    url: `${siteConfig.url}${app.href}`,
  });
}

/**
 * BreadcrumbList + ItemList of SoftwareApplication entries for the Tools
 * page. Only "live" apps get a full node - a "coming-soon" app has no page
 * yet to describe.
 */
export function buildToolsJsonLd(apps: AppItem[]) {
  const toolsUrl = `${siteConfig.url}/tools`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: siteConfig.url },
          { "@type": "ListItem", position: 2, name: "Tools", item: toolsUrl },
        ],
      },
      {
        "@type": "ItemList",
        "@id": `${toolsUrl}#items`,
        itemListElement: apps
          .filter((app) => app.status === "live")
          .map((app, index) => ({
            "@type": "ListItem",
            position: index + 1,
            item: buildSoftwareApplicationJsonLd(app),
          })),
      },
    ],
  };
}

/**
 * BreadcrumbList + SoftwareApplication for the On Deck landing page. On Deck
 * is not on the /tools shelf yet (it has no working app, only this explainer),
 * so the breadcrumb runs Home > On Deck and there's no `apps.ts` entry to pull
 * from. `offers` is omitted rather than asserting a price we haven't set.
 */
export function buildOnDeckLandingJsonLd() {
  const pageUrl = `${siteConfig.url}/on-deck`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: siteConfig.url },
          { "@type": "ListItem", position: 2, name: "On Deck", item: pageUrl },
        ],
      },
      softwareApplicationNode({
        id: `${pageUrl}#app`,
        name: "On Deck",
        description:
          "Live court rotation for pickleball socials. Players scan a sign to join the queue, and On Deck calls the next foursome as courts free up, keeping court time fair and varying who plays with whom.",
        url: pageUrl,
        // No public pricing set yet, so don't assert a zero-price Offer.
        free: false,
        publisher: true,
      }),
    ],
  };
}

/**
 * BreadcrumbList + SoftwareApplication + FAQPage for the Booking Buddy landing
 * page. Reachable via /tools, so the breadcrumb runs Home > Tools > Booking
 * Buddy even though the page itself sits at /booking-buddy.
 */
export function buildBookingBuddyLandingJsonLd(faqs: Faq[]) {
  const app = apps.find((item) => item.slug === "booking-buddy")!;
  const appUrl = `${siteConfig.url}${app.href}`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: siteConfig.url },
          { "@type": "ListItem", position: 2, name: "Tools", item: `${siteConfig.url}/tools` },
          { "@type": "ListItem", position: 3, name: app.title, item: appUrl },
        ],
      },
      buildSoftwareApplicationJsonLd(app),
      {
        "@type": "FAQPage",
        "@id": `${appUrl}#faq`,
        mainEntity: faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: { "@type": "Answer", text: faq.answer },
        })),
      },
    ],
  };
}

/**
 * BreadcrumbList + SoftwareApplication for one tool's own page, plus an
 * FAQPage node when the page carries a visible FAQ section. The questions and
 * answers must match what's rendered; Google flags FAQ markup that doesn't.
 */
export function buildAppPageJsonLd(
  app: AppItem,
  faqs: readonly { question: string; answer: string }[] = [],
) {
  const appUrl = `${siteConfig.url}${app.href}`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: siteConfig.url },
          { "@type": "ListItem", position: 2, name: "Tools", item: `${siteConfig.url}/tools` },
          { "@type": "ListItem", position: 3, name: app.title, item: appUrl },
        ],
      },
      buildSoftwareApplicationJsonLd(app),
      ...(faqs.length > 0
        ? [
            {
              "@type": "FAQPage",
              "@id": `${appUrl}#faq`,
              mainEntity: faqs.map((faq) => ({
                "@type": "Question",
                name: faq.question,
                acceptedAnswer: { "@type": "Answer", text: faq.answer },
              })),
            },
          ]
        : []),
    ],
  };
}
