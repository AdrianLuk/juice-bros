"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

/**
 * Puts the Broadcast Dark ground behind the whole marketing site - header,
 * page and footer together - rather than on each page's own wrapper.
 *
 * It has to be the shell and not the page. The floating pill nav is `sticky`
 * on interior routes, so it sits in flow *above* `<main>`: with `.bx-dark` on
 * the page, the strip the pill floats in belonged to the body and rendered as
 * a bare light band across the top of every dark page. The same gap shows on
 * overscroll. Owning the shell fixes both at once, and means a page component
 * carries only its own content.
 *
 * The four app worlds are excluded by path, not by opting in: Booking Buddy,
 * On Deck and Pickle Point Pal each have their own visual world and none of
 * them may see these tokens (DESIGN.md). `/s/[token]` and `/connect/[token]`
 * are Booking Buddy flows wearing the global chrome, so they stay on the
 * incumbent light ground until Booking Buddy's own world reaches them.
 *
 * `body:has(.bx-dark)` in globals.css paints the document behind this, which
 * is what the browser shows past the end of the page on an elastic scroll.
 */

const DARK_ROUTES = ["/", "/podcast", "/tools", "/gear", "/appearances", "/about", "/contact"];

/**
 * The tools that live under /tools but paint their own surface: Pickle Point
 * Pal (`.pp-surface`, panel white) and Match Mixer (`.mm-sheet`, paper white).
 * Both are committed light with no dark variant, so the dark shell would put a
 * near-black strip above their own ground. Their body ground is named beside
 * `body:has(.bx-dark)` in globals.css so the strip the pill nav floats in
 * belongs to the tool as well.
 */
const DARK_EXCEPTIONS = ["/tools/pickle-point-pal", "/tools/match-mixer"];

export function isDarkRoute(pathname: string): boolean {
  if (DARK_EXCEPTIONS.some((route) => pathname === route || pathname.startsWith(`${route}/`))) {
    return false;
  }
  return DARK_ROUTES.some(
    (route) => pathname === route || (route !== "/" && pathname.startsWith(`${route}/`)),
  );
}

export function SiteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "";

  return (
    <div className={`flex min-h-full flex-1 flex-col${isDarkRoute(pathname) ? " bx-dark" : ""}`}>
      {children}
    </div>
  );
}
