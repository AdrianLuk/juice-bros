import type { MetadataRoute } from "next";

import { apps } from "@/data/apps";
import { siteConfig } from "@/config/site";
import { getEpisodes } from "@/lib/episodes";

type Route = {
  path: string;
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;
  priority: number;
  lastModified?: Date;
};

const routes: Route[] = [
  { path: "/", changeFrequency: "weekly", priority: 1 },
  { path: "/podcast", changeFrequency: "weekly", priority: 0.9 },
  { path: "/appearances", changeFrequency: "weekly", priority: 0.6 },
  { path: "/tools", changeFrequency: "monthly", priority: 0.6 },
  { path: "/booking-buddy", changeFrequency: "monthly", priority: 0.7 },
  // Apps under /tools get an entry from their data. Booking Buddy sits on its
  // own path and is listed explicitly above.
  ...apps
    .filter((app) => app.href.startsWith("/tools/"))
    .map((app) => ({
      path: app.href,
      changeFrequency: "monthly" as const,
      priority: 0.4,
    })),
  { path: "/gear", changeFrequency: "monthly", priority: 0.6 },
  { path: "/about", changeFrequency: "yearly", priority: 0.5 },
  { path: "/contact", changeFrequency: "yearly", priority: 0.3 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const episodes = await getEpisodes();
  const episodeRoutes: Route[] = episodes.map((episode) => ({
    path: `/podcast/${episode.slug}`,
    changeFrequency: "monthly",
    priority: 0.7,
    lastModified: new Date(episode.published),
  }));

  return [...routes, ...episodeRoutes].map((route) => ({
    url: `${siteConfig.url}${route.path}`,
    lastModified: route.lastModified ?? new Date(),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
