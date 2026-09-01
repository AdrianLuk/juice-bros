"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { siblingsForPath } from "@/lib/booking-buddy/routes";

/**
 * The secondary tab row under a section page's `PageHeading` (ADR 0016) —
 * "Settings · Facilities", "Friends · Groups". The persistent "where am I"
 * signal: on desktop it's deliberately redundant with the top-bar dropdown, on
 * mobile it's the only place the siblings show at all.
 *
 * Rendered as a segmented control — a bordered track with a raised active chip
 * — rather than a bare row of links, so it reads unmistakably as tab navigation
 * you can click, not as a run of text (the old pill row only showed a fill on
 * hover, so the inactive tabs looked inert).
 *
 * Prop-less and `usePathname`-driven — every section page just drops it in
 * right after `<PageHeading>`, and it renders nothing on sections with no real
 * choice (Dashboard, Plan, Bookings).
 */
export function BbSectionNav() {
  const pathname = usePathname();
  const siblings = siblingsForPath(pathname ?? "");

  if (siblings.length === 0) {
    return null;
  }

  return (
    <nav
      className="mt-5 flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-border/70 bg-muted/40 p-1"
      aria-label="Section"
    >
      {siblings.map(({ label, href }) => {
        const active = pathname === href || pathname?.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative isolate inline-flex h-8 shrink-0 items-center rounded-lg px-3.5 text-[0.8rem] font-medium transition-colors",
              active
                ? "text-white"
                : "text-foreground/70 hover:text-brand-orange",
            )}
          >
            {/* Separate fill carrying `bb-section-pill` so it slides between
                siblings on navigation (globals.css). One active sibling at a
                time, so the name stays unique per snapshot. */}
            {active && (
              <span
                aria-hidden
                style={{ viewTransitionName: "bb-section-pill" }}
                className="absolute inset-0 -z-10 rounded-lg bg-brand-orange shadow-[0_1px_2px_oklch(0.55_0.16_40/0.35)]"
              />
            )}
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
