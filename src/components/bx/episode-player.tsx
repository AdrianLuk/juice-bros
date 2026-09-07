"use client";

import { useState } from "react";

import { PlayMark } from "./play-mark";

/**
 * A click-to-load YouTube player in Broadcast Dark's dress.
 *
 * Until the viewer hits play we render the poster and the page's own play mark
 * - no iframe, so none of YouTube's ~800 KB of player JS lands on first paint.
 * That JS used to compete with the hero for the main thread and pushed mobile
 * LCP past 3.5s (PROGRESS.md Phase 3.5). On click the real iframe swaps in with
 * autoplay, so it still behaves like a normal embed.
 *
 * This replaces the old `YoutubeEmbed`, which drew a brand-orange disc: on this
 * ground orange is the nav's colour and the focus ring, never a control, and a
 * second play affordance that looked nothing like the one on every thumbnail
 * would have given the site two gestures for one action.
 *
 * `morphTarget` names the poster as the shared element for the transition in
 * from a `.bx-tile` grid (see `episode-card.tsx`). Only ever one per page.
 *
 * The poster asks YouTube for `maxresdefault` (1280x720), because the grid's
 * `hqdefault` (480x360) upscaled across this much wider box is visibly blurry -
 * the fix from #416, which this component absorbed when the episode page moved
 * from a still image to a real player. `posterFallback` is that fix's other
 * half: not every video has a maxres thumbnail, and YouTube answers the ones
 * that don't with a grey placeholder rather than a 404, so the `onError` swap
 * matters. Pass the episode's own `thumbnail`.
 */
export function EpisodePlayer({
  videoId,
  title,
  poster,
  posterFallback,
  runtime,
  morphTarget = false,
  stage = true,
}: {
  videoId: string;
  title: string;
  poster?: string;
  posterFallback?: string;
  runtime?: string;
  morphTarget?: boolean;
  stage?: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const [posterSrc, setPosterSrc] = useState(
    poster ?? `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
  );
  const shape = `aspect-video w-full${stage ? " bx-stage" : ""}`;

  if (playing) {
    return (
      <div className={`bx-tile ${shape}`}>
        <iframe
          className="absolute inset-0 h-full w-full"
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      aria-label={`Play ${title}`}
      className={`bx-tile group ${shape}`}
    >
      {/* Decorative: the accessible name lives on the button's aria-label. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- YouTube CDN poster, no next/image optimization needed */}
      <img
        src={posterSrc}
        alt=""
        width={1280}
        height={720}
        fetchPriority="high"
        decoding="async"
        onError={() => posterFallback && setPosterSrc(posterFallback)}
        style={morphTarget ? { viewTransitionName: "jb-episode-hero" } : undefined}
      />
      <PlayMark />
      {runtime && <span className="bx-dur">{runtime}</span>}
    </button>
  );
}
