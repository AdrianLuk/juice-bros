import Link from "next/link";

import { siteConfig } from "@/config/site";
import { YoutubeIcon, SpotifyIcon, InstagramIcon } from "@/components/icons";

const socialLinks = [
  {
    name: "YouTube",
    href: siteConfig.links.youtube,
    icon: YoutubeIcon,
    hoverClass: "hover:border-[#ff0000]/40 hover:text-[#ff0000]",
  },
  {
    name: "Spotify",
    href: siteConfig.links.spotify,
    icon: SpotifyIcon,
    hoverClass: "hover:border-[#1db954]/40 hover:text-[#1db954]",
  },
  {
    name: "Instagram",
    href: siteConfig.links.instagram,
    icon: InstagramIcon,
    hoverClass: "hover:border-[#e1306c]/40 hover:text-[#e1306c]",
  },
];

export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden bg-brand-black text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/15 to-transparent"
      />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-14 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            {/* Decorative: the "Juice Bros Pickleball" wordmark sits right beside it. */}
            {/* eslint-disable-next-line @next/next/no-img-element -- local trusted SVG, no next/image optimization needed */}
            <img src="/brand/JB_Logo_White.svg" alt="" className="h-8 w-8" />
            <div>
              <p className="font-heading text-base font-semibold tracking-tight">
                {siteConfig.name}
              </p>
              <p className="text-sm text-white/50">The podcast for everyday players.</p>
            </div>
          </div>

          <nav className="grid grid-cols-2 gap-x-8 gap-y-2 sm:flex sm:gap-6">
            {siteConfig.nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm text-white/60 transition-colors duration-300 hover:text-white"
              >
                {item.title}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex flex-col-reverse items-center gap-6 border-t border-white/10 pt-8 sm:flex-row sm:justify-between">
          <p className="text-sm text-white/60">
            &copy; {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
          </p>
          <div className="flex items-center gap-3">
            {socialLinks.map((social) => (
              <a
                key={social.name}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={social.name}
                className={`group/social flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-0.5 hover:bg-white/10 active:translate-y-0 ${social.hoverClass}`}
              >
                <social.icon className="size-4" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
