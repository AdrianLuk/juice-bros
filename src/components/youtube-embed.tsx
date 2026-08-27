"use client";

import { useState } from "react";
import { PlayIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * A click-to-load YouTube embed. Until the viewer hits play we render just the
 * poster thumbnail and a button - no iframe, so none of YouTube's ~800 KB of
 * player JS lands on first paint. That JS was competing with the homepage hero
 * for the main thread and pushing its LCP past 3.5s on mobile (see PROGRESS.md
 * Phase 3.5). On click we swap in the real iframe with autoplay so the
 * interaction still feels like a normal embed.
 */
export function YoutubeEmbed({
  videoId,
  title,
  className,
}: {
  videoId: string;
  title: string;
  className?: string;
}) {
  const [activated, setActivated] = useState(false);

  if (activated) {
    return (
      <iframe
        className={cn("h-full w-full", className)}
        src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setActivated(true)}
      aria-label={`Play: ${title}`}
      className={cn(
        "group relative flex h-full w-full items-center justify-center overflow-hidden bg-brand-black",
        className,
      )}
    >
      {/* Decorative: the accessible name lives on the button's aria-label. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- YouTube CDN poster, no next/image optimization needed */}
      <img
        src={`https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`}
        alt=""
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover opacity-90 transition-opacity duration-300 group-hover:opacity-100"
      />
      <span className="relative flex size-16 items-center justify-center rounded-full bg-brand-orange text-white shadow-brand-lg transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-110">
        <PlayIcon className="size-7 translate-x-0.5 fill-current" />
      </span>
    </button>
  );
}
