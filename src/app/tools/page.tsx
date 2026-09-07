import type { Metadata } from "next";
import Link from "next/link";

import { apps } from "@/data/apps";
import { pageMetadata } from "@/lib/metadata";
import { buildToolsJsonLd, toJsonLdScript } from "@/lib/structured-data";
import { PageHead } from "@/components/bx/page-head";

export const metadata: Metadata = pageMetadata({
  title: "Tools",
  description:
    "Free browser-based pickleball tools from Juice Bros Pickleball. Plan games with friends, plus scorekeeping and serve tracking like a ref.",
  path: "/tools",
});

/**
 * The tools index, in Broadcast Dark.
 *
 * The incumbent showed four-across cards, each a grey box with a generic
 * lucide glyph above a one-line description - which told a visitor nothing
 * about what Booking Buddy is for, and made two shipped products look like
 * placeholders. The home page already fixed this for its own shelf by dropping
 * the icons and printing what each tool does; this page is the full version of
 * that, with room for what the tool actually does and what it asks of you
 * before you commit to opening it.
 *
 * Two panels across, not four: there are two tools, and a four-column grid
 * holding two cards reads as a page that lost half its contents.
 */
export default function ToolsPage() {
  return (
    <div className="flex w-full flex-1 flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toJsonLdScript(buildToolsJsonLd(apps)) }}
      />

      <PageHead
        title="Free tools for everyday players"
        meta={
          <>
            {apps.length} tools
            <span aria-hidden> &middot; </span>
            Free
            <span aria-hidden> &middot; </span>
            No ads
          </>
        }
        // "Free to use" states what is true today. An earlier draft promised
        // "they stay free", which PRODUCT.md explicitly leaves open - whether
        // any tool goes paid later is an undecided question, not a commitment
        // this page gets to make on Adrian's behalf.
        lead="Things we wanted for our own games and couldn't find, so we built them. Free to use, and more are coming as we get annoyed by more things."
      />

      <div className="bx-measure pb-20 sm:pb-28">
        <ul className="grid gap-5 lg:grid-cols-2">
          {apps.map((app) => (
            <li key={app.slug} className="flex">
              <Link
                href={app.href}
                className="bx-panel group flex w-full flex-col p-6 sm:p-8"
              >
                <h2 className="bx-h2 text-lg transition-colors duration-200 group-hover:text-[var(--bx-muted)] sm:text-xl">
                  {app.title}
                </h2>
                <p className="bx-meta mt-2.5">
                  {app.terms.map((term, index) => (
                    <span key={term}>
                      {index > 0 && <span aria-hidden> &middot; </span>}
                      {term}
                    </span>
                  ))}
                </p>
                <p className="mt-4 max-w-[46ch] text-[1.0625rem] leading-relaxed text-[var(--bx-muted)]">
                  {app.description}
                </p>

                <ul className="mt-6 flex flex-col gap-2.5">
                  {app.highlights.map((highlight) => (
                    <li
                      key={highlight}
                      className="flex gap-3 border-t border-[var(--bx-line-soft)] pt-2.5 text-[0.9375rem] leading-snug text-[var(--bx-muted)]"
                    >
                      {highlight}
                    </li>
                  ))}
                </ul>

                <p className="bx-actionlink mt-7 pt-1">
                  Open {app.title}
                  <span aria-hidden className="bx-arrow">
                    &rarr;
                  </span>
                </p>
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-8 max-w-[46ch] text-[0.9375rem] leading-relaxed text-[var(--bx-muted)]">
          More on the way. If there&apos;s something you keep doing by hand
          before a game,{" "}
          <Link href="/contact" className="font-semibold text-[var(--bx-ink)] underline">
            tell us
          </Link>{" "}
          and we&apos;ll look at building it.
        </p>
      </div>
    </div>
  );
}
