"use client";

import { useState } from "react";

/**
 * Episode page hero. Requests maxresdefault (1280x720) instead of the
 * hqdefault (480x360) used in grid tiles - hqdefault upscaled to fill this
 * much wider hero box was visibly blurry. Falls back to `fallbackSrc`
 * (hqdefault) on error for the rare video with no maxres thumbnail.
 */
export function EpisodeHeroImage({ id, fallbackSrc }: { id: string; fallbackSrc: string }) {
  const [src, setSrc] = useState(`https://i.ytimg.com/vi/${id}/maxresdefault.jpg`);

  return (
    // Decorative: the episode title is the <h1> directly below this.
    // eslint-disable-next-line @next/next/no-img-element -- YouTube CDN thumbnail, no next/image optimization needed
    <img
      src={src}
      alt=""
      onError={() => setSrc(fallbackSrc)}
      // Shared element for the transition in from the archive grid: the
      // clicked tile tags its own thumbnail with this same name on click
      // (episode-card.tsx) so the two morph. Same aspect ratio both ends,
      // so it's a clean grow. Fixed name - only ever one on a page.
      style={{ viewTransitionName: "jb-episode-hero" }}
      className="h-full w-full object-cover"
    />
  );
}
