import { siteConfig } from "@/config/site";
import { YoutubeIcon, SpotifyIcon } from "@/components/icons";
import { HeroBackdrop } from "./hero-backdrop";

/**
 * The full-bleed photo hero, kept from the incumbent and fixed rather than
 * replaced.
 *
 * Two things changed from the version this is based on:
 *
 * 1. The h1 is the positioning line, not the show's own name. The name is in
 *    the bar directly above it, and the largest text on the page telling a
 *    first-time visitor nothing was the incumbent's real defect.
 * 2. The hero is no longer a full viewport tall. At `min-h-[calc(100dvh-4rem)]`
 *    nothing playable reached the first screen, which works against the one
 *    metric this page exists to move. It is now sized so the newest episode
 *    breaks the fold underneath it.
 *
 * The scrim stays. Darkening a photograph behind type is how you put type on a
 * photograph, not a flaw to design around.
 */
export function PhotoHero() {
  return (
    <section className="relative isolate flex min-h-[30rem] flex-col justify-end overflow-hidden lg:min-h-[34rem]">
      {/* LCP element. The hand-optimised WebP variants are the same ones the
          incumbent hero shipped (see PROGRESS.md Phase 3.5); the .jpeg is the
          fallback for anything ignoring <source>. */}
      <picture>
        <source
          type="image/webp"
          srcSet="/brand/JB_Banner-768.webp 768w, /brand/JB_Banner-1280.webp 1280w, /brand/JB_Banner-1600.webp 1600w"
          sizes="100vw"
        />
        <img
          src="/brand/JB_Banner_1920.jpeg"
          alt=""
          width={1600}
          height={901}
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 -z-10 size-full object-cover object-center"
        />
      </picture>

      {/* Static fallback for the citrus field: the warm glow carries the idea
          when WebGL is unavailable. The canvas screen-blends over this. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 mix-blend-screen bg-[radial-gradient(ellipse_60%_50%_at_50%_58%,color-mix(in_oklch,var(--brand-orange),transparent_78%)_0%,transparent_70%)]"
      />
      <HeroBackdrop />

      {/* The scrim: a vertical ramp into the page's own ground so the hero does
          not end on a hard edge, plus an even wash for type legibility. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[6] bg-[linear-gradient(to_top,var(--bx-bg)_0%,color-mix(in_oklch,var(--bx-bg),transparent_25%)_38%,color-mix(in_oklch,var(--bx-bg),transparent_65%)_100%)]"
      />
      {/* A second, shorter ramp under the bar. The photograph has to run to the
          top of the page, but the banner's brightest passage sits exactly where
          the nav items land, so without this the middle of the menu reads
          against a lit straw. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-[7] h-28 bg-[linear-gradient(to_bottom,color-mix(in_oklch,var(--bx-bg),transparent_20%)_0%,transparent_100%)]"
      />

      <div className="bx-measure relative z-10 pt-24 pb-12 sm:pt-32 sm:pb-14">
        <h1 className="bx-display max-w-[18ch] text-[clamp(2rem,5.4vw,3.5rem)]">
          Pickleball, from two guys still trying to get good at it.
        </h1>
        <p className="mt-4 max-w-[46ch] text-[1.0625rem] leading-relaxed text-[var(--bx-muted)]">
          {siteConfig.description}
        </p>

        <div className="mt-7 flex flex-wrap gap-2.5">
          <a
            href={siteConfig.links.youtube}
            target="_blank"
            rel="noopener noreferrer"
            className="bx-btn bx-btn-play"
          >
            <YoutubeIcon className="size-4" />
            Watch on YouTube
          </a>
          <a
            href={siteConfig.links.spotify}
            target="_blank"
            rel="noopener noreferrer"
            className="bx-btn bx-btn-ghost"
          >
            <SpotifyIcon className="size-4" />
            Listen on Spotify
          </a>
        </div>
      </div>
    </section>
  );
}
