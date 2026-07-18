import { siteConfig } from "@/config/site";

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
