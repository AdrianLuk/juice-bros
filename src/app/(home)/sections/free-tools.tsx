import Link from "next/link";

import { apps } from "@/data/apps";

/**
 * The two free tools.
 *
 * Deliberately not the incumbent's icon tiles: a big grey box with a generic
 * glyph in it tells a visitor nothing about what Booking Buddy does. These are
 * panels carrying the tool's name, what it actually does, and its terms, which
 * is the information someone deciding whether to open it needs.
 */
export function FreeTools() {
  if (apps.length === 0) return null;

  return (
    <section className="bx-measure bx-hair py-10 sm:py-14">
      <div className="flex items-baseline justify-between gap-6">
        <h2 className="bx-h2 text-lg sm:text-xl">Free tools we built</h2>
        <Link
          href="/tools"
          className="text-sm text-[var(--bx-muted)] transition-colors duration-200 hover:text-[var(--bx-ink)]"
        >
          All tools
        </Link>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {apps.map((app) => (
          <Link key={app.slug} href={app.href} className="bx-panel group flex flex-col p-6 sm:p-7">
            <h3 className="bx-h2 text-base transition-colors duration-200 group-hover:text-[var(--bx-muted)] sm:text-lg">
              {app.title}
            </h3>
            <p className="mt-2.5 max-w-[46ch] text-[0.9375rem] leading-relaxed text-[var(--bx-muted)]">
              {app.description}
            </p>
            <p className="bx-meta mt-5">
              {app.terms.map((term, index) => (
                <span key={term}>
                  {index > 0 && <span aria-hidden> · </span>}
                  {term}
                </span>
              ))}
            </p>
            <p className="mt-3 text-sm font-semibold text-[var(--bx-ink)]">
              Open {app.title}
              <span aria-hidden className="ml-1.5 inline-block transition-transform duration-200 group-hover:translate-x-0.5">
                &rarr;
              </span>
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
