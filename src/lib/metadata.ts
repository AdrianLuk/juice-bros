import type { Metadata } from "next";

import { siteConfig } from "@/config/site";

type OgImage = { url: string; alt: string; width?: number; height?: number };

const DEFAULT_OG_IMAGE: OgImage = {
  url: siteConfig.ogImage,
  width: 1200,
  height: 630,
  alt: siteConfig.name,
};

export function pageMetadata({
  title,
  description,
  path,
  image = DEFAULT_OG_IMAGE,
  video,
}: {
  title?: string;
  description: string;
  path: string;
  image?: OgImage;
  video?: { url: string; width?: number; height?: number };
}): Metadata {
  const openGraphBase = {
    ...(title ? { title } : {}),
    description,
    url: path,
    siteName: siteConfig.name,
    images: [image],
  };

  return {
    ...(title ? { title } : {}),
    description,
    alternates: {
      canonical: path,
    },
    openGraph: video
      ? { ...openGraphBase, type: "video.other", videos: [video] }
      : { ...openGraphBase, type: "website" },
    twitter: {
      card: "summary_large_image",
      ...(title ? { title } : {}),
      description,
      images: [image.url],
    },
  };
}
