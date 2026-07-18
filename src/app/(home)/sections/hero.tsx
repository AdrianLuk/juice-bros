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
    <section className="relative flex min-h-[calc(100svh-4rem)] flex-col overflow-hidden bg-brand-black text-white md:block md:min-h-0">
      {/* eslint-disable-next-line @next/next/no-img-element -- local trusted asset, no next/image optimization needed */}
      <img
        src="/brand/JB_Banner_1920.jpeg"
        alt="Juice Bros Pickleball hosts"
        width={1600}
        height={901}
        className="w-full object-cover object-center md:max-h-[calc(100vh-4rem)] md:min-h-160"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden bg-[radial-gradient(ellipse_at_center,color-mix(in_oklch,var(--brand-black),transparent_15%)_0%,color-mix(in_oklch,var(--brand-black),transparent_55%)_100%)] md:block"
      />
      <div className="flex flex-1 items-center justify-center md:absolute md:inset-0 md:flex-none">
        <div className="flex w-full flex-col items-center gap-5 px-4 py-12 text-center sm:px-6 md:py-10 md:drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] lg:px-8">
          <Eyebrow color="yellow">For Everyday Pickleball Players</Eyebrow>
          <h1 className="max-w-2xl font-heading text-4xl font-black tracking-tight text-balance sm:text-6xl">
            Juice Bros Pickleball
          </h1>
          <p className="max-w-xl text-lg text-white/90 text-balance">
            {siteConfig.description}
          </p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <Button
              size="lg"
              nativeButton={false}
              className="h-11 px-6 text-base"
              render={<a href={siteConfig.links.youtube} target="_blank" rel="noopener noreferrer" />}
            >
              <YoutubeIcon className="size-5" />
              Watch Latest Episode
            </Button>
            <Button
              size="lg"
              nativeButton={false}
              className="h-11 bg-[#1db954] px-6 text-base text-white hover:bg-[#1db954]/90"
              render={<a href={siteConfig.links.spotify} target="_blank" rel="noopener noreferrer" />}
            >
              <SpotifyIcon className="size-5" />
              Listen on Spotify
            </Button>
          </div>
          <div className="mt-4 flex items-center gap-5">
            {socialLinks.map((social) => (
              <a
                key={social.name}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={social.name}
                className={`text-white/85 transition-colors ${social.hoverClass}`}
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
