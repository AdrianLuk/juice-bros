"use client";

import { useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The dashboard's one orchestrated pin-drop cascade (`.bb-board-load`, globals.css)
 * should play once per *app load* — a cold PWA launch or a hard refresh — not
 * every time someone taps back to the dashboard from another tab.
 *
 * On a client navigation the directional route transition
 * (`booking-buddy/template.tsx`) is already the motion; re-dropping every card
 * on top of it reads as a web page reloading, not a native screen coming
 * forward. The module-scope flag survives the App Router's client-side
 * navigations (the module isn't re-evaluated), so the cascade is armed only for
 * the first dashboard render of the session and disarmed for every return.
 *
 * `display: contents` keeps this wrapper out of the box tree entirely: the
 * cards stay direct flex children of `BoardRegion`'s content row, and
 * `.bb-board-load > *` still resolves to them (the `>` combinator walks the DOM,
 * which `display: contents` doesn't change).
 */
let hasPlayed = false;

export function BoardLoadOnce({ children }: { children: ReactNode }) {
  const [play] = useState(() => {
    if (hasPlayed) return false;
    hasPlayed = true;
    return true;
  });

  return (
    <div className={cn("contents", play && "bb-board-load")}>{children}</div>
  );
}
