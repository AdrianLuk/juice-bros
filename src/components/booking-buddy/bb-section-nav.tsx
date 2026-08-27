"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { siblingsForPath } from "@/lib/booking-buddy/routes";

/**
 * The secondary pill row under a section page's `PageHeading` (ADR 0016) —
 * "Bookings · Facilities", "Friends · Groups". The persistent "where am I"
 * signal: on desktop it's deliberately redundant with the top-bar dropdown, on
 * mobile it's the only place the siblings show at all.
 *
 * Prop-less and `usePathname`-driven — every section page just drops it in
 * right after `<PageHeading>`, and it renders nothing on sections with no real
 * choice (Dashboard, Plan, Settings).
 */
export function BbSectionNav() {
  const pathname = usePathname();
  const siblings = siblingsForPath(pathname ?? "");

  if (siblings.length === 0) {
    return null;
  }

  return (
    <nav
      className="mt-5 flex flex-wrap items-center gap-1.5"
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
              "inline-flex h-7 items-center rounded-full px-3 text-[0.8rem] font-medium transition-colors",
              active
                ? "bg-brand-orange text-white shadow-[0_1px_2px_oklch(0.55_0.16_40/0.35)]"
                : "text-foreground/70 hover:bg-brand-orange/10 hover:text-brand-orange",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
