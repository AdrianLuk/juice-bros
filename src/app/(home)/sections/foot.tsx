import Link from "next/link";

import { siteConfig } from "@/config/site";
import { YoutubeIcon, SpotifyIcon, InstagramIcon } from "@/components/icons";

const socials = [
  { name: "YouTube", href: siteConfig.links.youtube, icon: YoutubeIcon },
  { name: "Spotify", href: siteConfig.links.spotify, icon: SpotifyIcon },
  { name: "Instagram", href: siteConfig.links.instagram, icon: InstagramIcon },
];

/**
 * The home page's own footer. `/` suppresses the global `SiteFooter`
 * (`SiteChromeSlot`) so the near-black look runs to the bottom of the page
 * instead of handing off to a different one two sections from the end.
 *
 * It closes on the action the whole page is for: subscribing on YouTube.
 */
export function Foot() {
  return (
    <footer className="bx-hair mt-4">
      <div className="bx-measure py-14 sm:py-16">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="bx-h2 max-w-[20ch] text-[1.375rem] sm:text-2xl">
              New episode every week. Come argue with us.
            </h2>
            <p className="mt-2.5 text-[0.9375rem] text-[var(--bx-muted)]">
              Free on YouTube, or audio only on Spotify.
            </p>
          </div>
          <a
            href={siteConfig.links.youtube}
            target="_blank"
            rel="noopener noreferrer"
            className="bx-btn bx-btn-sub shrink-0 self-start px-6 py-3.5 text-base sm:self-auto"
          >
            <YoutubeIcon className="size-[1.125rem]" />
            Subscribe on YouTube
          </a>
        </div>

        <div className="bx-hair mt-12 flex flex-col gap-8 pt-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-2.5">
            {/* Decorative: the wordmark sits right beside it. */}
            {/* eslint-disable-next-line @next/next/no-img-element -- local trusted SVG, no next/image optimization needed */}
            <img src="/brand/JB_Logo_White.svg" alt="" className="size-7 shrink-0" />
            <span className="text-[0.9375rem] font-semibold tracking-tight">
              {siteConfig.name}
            </span>
          </div>

          <nav aria-label="Footer">
            <ul className="grid grid-cols-2 gap-x-10 gap-y-2.5 sm:flex sm:gap-7">
              {siteConfig.nav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-[var(--bx-muted)] transition-colors duration-200 hover:text-[var(--bx-ink)]"
                  >
                    {item.title}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="bx-hair mt-8 flex flex-col-reverse items-start gap-5 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="bx-meta normal-case tracking-normal">
            &copy; {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
          </p>
          <ul className="flex items-center gap-2">
            {socials.map((social) => (
              <li key={social.name}>
                <a
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.name}
                  className="bx-btn bx-btn-ghost size-10 p-0"
                >
                  <social.icon className="size-4" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
