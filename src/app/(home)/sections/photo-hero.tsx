import { siteConfig } from "@/config/site";
import { YoutubeIcon, SpotifyIcon } from "@/components/icons";
import { HeroBackdrop } from "./hero-backdrop";

/**
 * The full-bleed photo hero, kept from the incumbent rather than replaced -
 * Adrian's call: the two of them in frame is the thing he wants a visitor to
 * meet first.
 *
 * One thing changed from the incumbent: the h1 is the positioning line, not the
 * show's own name. The name is in the floating pill directly above it, and the
 * largest text on the page telling a first-time visitor nothing was the real
 * defect. The scrim stays, and so does the full viewport height on desktop -
 * the global pill nav floats over it (`hasOverlayHero` in SiteHeader), so the
 * section owns the whole first screen. Nothing playable reaches that screen;
 * the Now Playing band directly under it is where the page pays that back.
 *
 * Two layouts, not one:
 *
 * - **Wide**, the banner is the background and the copy sits on it, which is
 *   what the image was composed for: the hosts are on the left and right thirds
 *   and the middle is clear.
 * - **Narrow**, the banner is a plain block and the copy sits underneath it on
 *   the page's own ground. Cropping a 16:9 two-shot into a phone-shaped box
 *   puts the hosts off-frame and drops the type onto whatever is left, so the
 *   overlay stops being legible exactly where most visitors are.
 */
export function PhotoHero() {
  return (
    <section className="relative isolate flex flex-col sm:min-h-[100svh] sm:justify-end sm:overflow-hidden">
      {/* Narrow: an in-flow banner block. Wide: the background of the section,
          with the copy laid over it. */}
      <div className="relative sm:absolute sm:inset-0 sm:-z-10">
        <picture>
          <source
            type="image/webp"
            srcSet="/brand/JB_Banner-768.webp 768w, /brand/JB_Banner-1280.webp 1280w, /brand/JB_Banner-1600.webp 1600w"
            sizes="100vw"
          />
          <img
            src="/brand/JB_Banner_1920.jpeg"
            alt="Daven and Adrian, the hosts of Juice Bros Pickleball"
            width={1600}
            height={901}
            fetchPriority="high"
            decoding="async"
            className="h-56 w-full object-cover object-center sm:h-full"
          />
        </picture>

        {/* Static fallback for the citrus field: the warm glow carries the idea
            when WebGL is unavailable. The canvas screen-blends over this. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 mix-blend-screen bg-[radial-gradient(ellipse_60%_50%_at_50%_58%,color-mix(in_oklch,var(--brand-orange),transparent_78%)_0%,transparent_70%)]"
        />
        <HeroBackdrop />

        {/* Narrow, the banner only needs its foot softened into the ground it
            sits above. Wide, the whole image carries type and takes the full
            ramp plus an even wash. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[6] h-20 bg-[linear-gradient(to_top,var(--bx-bg),transparent)] sm:inset-0 sm:h-auto sm:bg-[linear-gradient(to_top,var(--bx-bg)_0%,var(--bx-bg)_14%,color-mix(in_oklch,var(--bx-bg),transparent_22%)_42%,color-mix(in_oklch,var(--bx-bg),transparent_65%)_100%)]"
        />
      </div>

      <div className="bx-measure relative z-10 pt-8 pb-4 sm:pt-32 sm:pb-14">
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
            className="bx-btn bx-btn-yt"
          >
            <YoutubeIcon className="size-4" />
            Watch on YouTube
          </a>
          <a
            href={siteConfig.links.spotify}
            target="_blank"
            rel="noopener noreferrer"
            className="bx-btn bx-btn-sp"
          >
            <SpotifyIcon className="size-4" />
            Listen on Spotify
          </a>
        </div>
      </div>
    </section>
  );
}
