"use client";

import { useEffect } from "react";

/**
 * Pickle Point Pal moves between several full-screen steps inside one page —
 * setup, coin toss, live play, the summary — and each can be scrolled to
 * wherever the previous step left off (a tall setup form, a long match log).
 * Call with a key that changes exactly when the visible screen changes; this
 * jumps the page back to the top so the next screen starts right under the
 * header instead of mid-scroll.
 *
 * A plain jump, not `behavior: "smooth"` — this is a reset for a ref who
 * needs the new screen readable immediately, not a visual flourish.
 */
export function useScrollToTopOnChange(screenKey: string | number): void {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screenKey]);
}
