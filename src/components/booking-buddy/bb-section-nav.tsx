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
      className="mt-6 flex w-fit max-w-full items-end gap-1.5 pt-1"
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
              "relative isolate inline-flex h-9 shrink-0 items-center rounded-sm px-4 font-bb-sign text-[0.72rem] tracking-[0.12em] uppercase transition-colors",
              // Card-stock tabs on the board — the active one raised and
              // "pinned", the rest tucked lower and duller.
              active
                ? "text-foreground"
                : "translate-y-1 border border-border/70 bg-[color-mix(in_oklch,var(--card),transparent_25%)] text-[color-mix(in_oklch,var(--foreground),transparent_28%)] hover:text-foreground",
            )}
          >
            {active && (
              <span
                aria-hidden
                style={{ viewTransitionName: "bb-section-pill" }}
                className="bb-card absolute inset-0 -z-10"
              />
            )}
            {active && (
              <span
                aria-hidden
                className="bb-pin bb-pin--commit"
                style={{
                  top: "-0.4rem",
                  width: "0.75rem",
                  height: "0.75rem",
                  marginLeft: "-0.375rem",
                }}
              />
            )}
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
