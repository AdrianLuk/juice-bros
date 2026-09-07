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
 * Composition is a close, not a seventh stacked block. Differentiation above
 * it already runs heading-then-prose set left at major air, and shipping the
 * same shape again at the same rank is exactly the flatness this redesign set
 * out to end - the incumbent's last three sections were indistinguishable in
 * every channel. So this one turns: the ask and the two ways to answer it sit
 * side by side on a wide screen, at tighter air than the majors above, and the
 * page arrives at something that reads as an ending rather than as one more
 * section that happens to be last.
 *
 * Copy unchanged from the published About page.
 */
export function JoinIn() {
  return (
    <section className="bx-measure py-12 sm:py-16">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-16">
        <div>
          <h2 className="bx-h2 max-w-[20ch] text-[clamp(1.375rem,3.2vw,1.875rem)]">
            This only works if you&apos;re part of it
          </h2>
          <p className="mt-5 max-w-[52ch] text-[1.0625rem] leading-relaxed text-[var(--bx-muted)]">
            Got a story from your local courts? A club we should know about? A
            hot take you need to get off your chest? We want to hear it. Follow
            along, send us a message, or just show up in the comments.
            That&apos;s half the show.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
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
