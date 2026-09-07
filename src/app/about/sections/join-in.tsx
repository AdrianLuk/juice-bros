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
 * Composition is a close, not a seventh block at major air. It is a narrow
 * column - the only narrow measure on the page - stacked and set left at the
 * page's tightest air, so it reads as a sign-off rather than as one more
 * section that happens to be last.
 *
 * It got there by way of the wrong answer. A first pass split it into heading
 * left and actions right-flush, which did separate it from Differentiation
 * above - and landed it on the exact shape of the global footer close directly
 * beneath it, two-line heading and a right-flush button group with a single
 * hairline between them. That traded a repeat two sections apart for one
 * immediately adjacent, which is worse. The footer keeps the shape it owns
 * sitewide; this narrows instead.
 *
 * Copy unchanged from the published About page.
 */
export function JoinIn() {
  return (
    <section className="bx-measure py-12 sm:py-16">
      <div className="max-w-[34rem]">
        <h2 className="bx-h2 max-w-[20ch] text-[clamp(1.375rem,3.2vw,1.875rem)]">
          This only works if you&apos;re part of it
        </h2>
        <p className="mt-5 text-[1.0625rem] leading-relaxed text-[var(--bx-muted)]">
          Got a story from your local courts? A club we should know about? A hot
          take you need to get off your chest? We want to hear it. Follow along,
          send us a message, or just show up in the comments. That&apos;s half
          the show.
        </p>

        <div className="mt-7 flex flex-wrap gap-3">
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
            Send Us a Message
          </Link>
        </div>
      </div>
    </section>
  );
}
