"use client";

import { useEffect } from "react";

/**
 * Scrolls the "Post a game" section into view when the page was opened via a
 * "Propose a game" deep link — the buttons on "Find a time" and "Friends
 * looking to play" (#272).
 *
 * Next.js already scrolls to a `#post-a-game` hash on navigation, but that
 * misses both ways this link is followed: arriving from "Find a time" the
 * Games page streams in behind `loading.tsx`, so the section isn't mounted
 * yet when the router looks for it; clicking from the "Friends looking to
 * play" list on this same page only changes the query string, which the
 * router doesn't treat as a hash navigation at all.
 *
 * `prefillKey` is empty on a plain visit and a stable `date|start|end` string
 * when a deep link is active — so this fires on first mount and again whenever
 * a fresh "Propose a game" changes the target, and never on a plain visit.
 *
 * Renders nothing.
 */
export function ScrollToPostAGame({ prefillKey }: { prefillKey: string }) {
  useEffect(() => {
    if (!prefillKey) {
      return;
    }

    const target = document.getElementById("post-a-game");
    if (!target) {
      return;
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // One frame's grace so the directional route transition has committed and
    // layout is settled before we measure.
    const frame = requestAnimationFrame(() => {
      target.scrollIntoView({
        behavior: reduced ? "auto" : "smooth",
        block: "start",
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [prefillKey]);

  return null;
}
