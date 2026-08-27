import { siteConfig } from "@/config/site";
import { Button } from "@/components/ui/button";
import { YoutubeIcon, SpotifyIcon, InstagramIcon } from "@/components/icons";
import { Eyebrow } from "@/components/typography/eyebrow";

const socialLinks = [
  {
    name: "YouTube",
    href: siteConfig.links.youtube,
    icon: YoutubeIcon,
    hoverClass: "hover:text-[#ff0000]",
  },
  {
    name: "Spotify",
    href: siteConfig.links.spotify,
    icon: SpotifyIcon,
    hoverClass: "hover:text-[#1db954]",
  },
  {
    name: "Instagram",
    href: siteConfig.links.instagram,
    icon: InstagramIcon,
    hoverClass: "hover:text-[#e1306c]",
  },
];

export function Hero() {
  return (
    <section className="relative flex min-h-[calc(100dvh-3.5rem)] flex-col overflow-hidden bg-brand-black text-white sm:block sm:min-h-0">
      {/* LCP element - hand-optimized WebP variants (see PROGRESS.md Phase 3.5),
          eager + high priority so it paints as fast as possible. The .jpeg src
          is the fallback for anything that ignores <source>. */}
      <picture>
        <source
          type="image/webp"
          srcSet="/brand/JB_Banner-768.webp 768w, /brand/JB_Banner-1280.webp 1280w, /brand/JB_Banner-1600.webp 1600w"
          sizes="100vw"
        />
        <img
          src="/brand/JB_Banner_1920.jpeg"
          alt="Juice Bros Pickleball hosts"
          width={1600}
          height={901}
          fetchPriority="high"
          decoding="async"
          className="w-full object-cover object-center opacity-90 sm:max-h-dvh sm:min-h-160"
        />
      </picture>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden bg-[radial-gradient(ellipse_at_center,color-mix(in_oklch,var(--brand-black),transparent_10%)_0%,color-mix(in_oklch,var(--brand-black),transparent_60%)_55%,var(--brand-black)_100%)] sm:block"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-linear-to-t from-brand-black to-transparent sm:hidden"
      />
      <div className="flex flex-1 items-center justify-center sm:absolute sm:inset-0 sm:flex-none">
        <div className="flex w-full flex-col items-center gap-6 px-4 py-14 text-center sm:px-6 sm:py-10 sm:drop-shadow-[0_2px_16px_rgba(0,0,0,0.85)] lg:px-8">
          <Eyebrow color="yellow">For Everyday Pickleball Players</Eyebrow>
          <h1 className="max-w-3xl font-heading text-5xl font-black tracking-[-0.03em] text-balance sm:text-7xl">
            Juice Bros Pickleball
          </h1>
          <p className="max-w-xl text-lg text-white/80 text-balance">
            {siteConfig.description}
          </p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <Button
              size="lg"
              nativeButton={false}
              className="group h-12 rounded-full pr-2 pl-6 text-base shadow-brand"
              render={<a href={siteConfig.links.youtube} target="_blank" rel="noopener noreferrer" />}
            >
              Watch Latest Episode
              <span className="flex size-8 items-center justify-center rounded-full bg-white/15 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5">
                <YoutubeIcon className="size-4" />
              </span>
            </Button>
            <Button
              size="lg"
              nativeButton={false}
              className="group h-12 rounded-full bg-[#1db954] pr-2 pl-6 text-base text-white hover:bg-[#1db954]/90"
              render={<a href={siteConfig.links.spotify} target="_blank" rel="noopener noreferrer" />}
            >
              Listen on Spotify
              <span className="flex size-8 items-center justify-center rounded-full bg-white/15 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5">
                <SpotifyIcon className="size-4" />
              </span>
            </Button>
          </div>
          <div className="mt-5 flex items-center gap-5">
            {socialLinks.map((social) => (
              <a
                key={social.name}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={social.name}
                className={`text-white/70 transition-colors duration-300 ${social.hoverClass}`}
              >
                <social.icon className="size-6" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
