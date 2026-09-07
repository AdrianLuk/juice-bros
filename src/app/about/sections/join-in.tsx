import Link from "next/link";

import { siteConfig } from "@/config/site";
import { InstagramIcon } from "@/components/icons";

/**
 * The About page's close.
 *
 * The site footer directly below closes on subscribing, so this one doesn't:
 * two subscribe asks stacked on top of each other cancel out. This page's own
 * ask is participation, which is what the published copy already says, so it
 * sends people to Instagram and to the contact form and leaves YouTube to the
 * footer.
 *
 * The Instagram button wears Instagram's own colour, under the same rule the
 * YouTube and Spotify buttons follow: a destination button carries its
 * destination's brand, with its ink resolved from a real contrast check.
 * White on `#e1306c` measures 4.34:1 - the same register as the YouTube red
 * already shipping here, and kept for the same reason.
 *
 * Copy unchanged from the published About page.
 */
export function JoinIn() {
  return (
    <section className="bx-measure py-16 sm:py-24">
      <h2 className="bx-h2 max-w-[20ch] text-[clamp(1.375rem,3.2vw,1.875rem)]">
        This only works if you&apos;re part of it
      </h2>
      <p className="mt-5 max-w-[52ch] text-[1.0625rem] leading-relaxed text-[var(--bx-muted)]">
        Got a story from your local courts? A club we should know about? A hot
        take you need to get off your chest? We want to hear it. Follow along,
        send us a message, or just show up in the comments. That&apos;s half the
        show.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <a
          href={siteConfig.links.instagram}
          target="_blank"
          rel="noopener noreferrer"
          className="bx-btn bx-btn-ig"
        >
          <InstagramIcon className="size-[1.125rem]" />
          Follow on Instagram
        </a>
        <Link href="/contact" className="bx-btn bx-btn-ghost">
          Send us a message
        </Link>
      </div>
    </section>
  );
}
