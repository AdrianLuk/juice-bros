import { siteConfig } from "@/config/site";
import type { Episode } from "@/lib/episodes";

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
          {
            "@type": "ListItem",
            position: 1,
            name: "Podcast",
            item: `${siteConfig.url}/podcast`,
          },
          {
            "@type": "ListItem",
            position: 2,
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
