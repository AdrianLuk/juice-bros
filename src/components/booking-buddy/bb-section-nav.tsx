"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
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
              buttonVariants({
                variant: active ? "secondary" : "ghost",
                size: "sm",
              }),
              "rounded-full",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
