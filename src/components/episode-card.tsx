"use client";

import Link from "next/link";
import { useRef } from "react";

import type { Episode } from "@/lib/episodes";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

/**
 * One tile in the episode grid.
 *
 * `morph` (set only by the Podcast archive, through `VideoGrid`) makes the
 * thumbnail the shared element for the route transition into `/podcast/[slug]`:
 * the episode page's hero `<img>` carries the fixed name `jb-episode-hero`
 * (see that page), and on click this tile tags its own thumbnail with the same
 * name, so the browser grows one image into the other under the marketing page
 * transition (`app/template.tsx` + globals.css).
 *
 * The tag is set at click time rather than in render on purpose: only the one
 * image actually navigated from may carry the name when the transition
 * snapshots — every tile carrying it (or a per-id name) would pull the whole
 * grid out of the page snapshot to animate tile by tile. A fresh mount (the
 * back navigation, say) re-renders the `<img>` without it, so nothing leaks.
 */
export function EpisodeCard({
  episode,
  morph = false,
}: {
  episode: Episode;
  morph?: boolean;
}) {
  const imgRef = useRef<HTMLImageElement>(null);

  return (
    <Link
      href={`/podcast/${episode.slug}`}
      onClick={
        morph
          ? () => {
              imgRef.current?.style.setProperty(
                "view-transition-name",
                "jb-episode-hero",
              );
            }
          : undefined
      }
      className="group flex flex-col overflow-hidden rounded-3xl bg-black/3 p-1.5 shadow-brand ring-1 ring-black/5 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-1 hover:shadow-brand-lg"
    >
      <div className="aspect-video overflow-hidden rounded-[1.25rem]">
        {/* Decorative: this thumbnail sits inside the same link as the episode
            title below, so real alt text would just make a screen reader
            announce the title twice for one link. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- YouTube CDN thumbnail, no next/image optimization needed */}
        <img
          ref={imgRef}
          src={episode.thumbnail}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-105"
        />
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3.5">
        <h3 className="line-clamp-2 font-medium transition-colors duration-300 group-hover:text-brand-orange">
          {episode.title}
        </h3>
        <p className="mt-auto pt-1 text-sm text-muted-foreground">
          {dateFormatter.format(new Date(episode.published))}
        </p>
      </div>
    </Link>
  );
}
