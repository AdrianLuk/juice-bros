import Link from "next/link";

import { siteConfig } from "@/config/site";
import { YoutubeIcon, SpotifyIcon, InstagramIcon } from "@/components/icons";

const socials = [
  { name: "YouTube", href: siteConfig.links.youtube, icon: YoutubeIcon },
  { name: "Spotify", href: siteConfig.links.spotify, icon: SpotifyIcon },
  { name: "Instagram", href: siteConfig.links.instagram, icon: InstagramIcon },
];

/**
 * The site footer, in Broadcast Dark.
 *
 * Began as the home page's private `Foot` while `/` was the only route in this
 * look, with `SiteChromeSlot` suppressing the global footer there so the page
 * would not hand off to a different one two sections from the end. Now that
 * every marketing route wears the look, that split has no job left: this is the
 * global footer and the exception is gone.
 *
 * It closes on the action the whole site is for - subscribing on YouTube - and
 * carries no newsletter signup. Audience growth on those two platforms is the
 * stated success metric (PRODUCT.md), a second capture ask on every page splits
 * it, and there is no publication to post a form to. Adrian's call, 2026-09-06.
 *
 * It carries `bx-dark` itself rather than inheriting it: the footer also
 * renders on routes outside the dark shell (`/s/[token]`, `/connect/[token]`,
 * the On Deck landing), where every `--bx-*` reference would otherwise resolve
 * to nothing and the whole block would come out unpainted. The incumbent footer
 * was near-black on those pages too, so nothing about them changes.
 */
export function SiteFooter() {
  return (
    <footer className="bx-dark bx-hair mt-4">
      <div className="bx-measure py-14 sm:py-16">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="bx-h2 max-w-[20ch] text-[clamp(1.375rem,3.2vw,1.875rem)]">
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
            className="bx-btn bx-btn-yt shrink-0 self-start px-6 py-3.5 text-base sm:self-auto"
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
                  <Link href={item.href} className="bx-quietlink">
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
                  className="bx-btn bx-btn-ghost size-11 p-0"
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
