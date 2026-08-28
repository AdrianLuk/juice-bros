"use client";

import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function useInView<T extends HTMLElement>(amount: number) {
  const ref = useRef<T>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Reduced motion never hides content in the first place (the CSS is behind
    // `prefers-reduced-motion: no-preference`), so there is nothing to observe.
    if (window.matchMedia(REDUCED_MOTION).matches) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShown(true);
          observer.disconnect();
        }
      },
      { threshold: amount, rootMargin: "0px 0px -6% 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [amount]);

  return { ref, shown };
}

/**
 * Scroll-into-view reveal for marketing sections. The element starts offset and
 * transparent and settles once, the first time it crosses into view, on the
 * site's usual cubic-bezier(0.32,0.72,0,1). An IntersectionObserver rather than
 * a CSS scroll timeline so "play once and stay" is exact and there is no
 * first-paint flash of hidden content.
 *
 * The hidden start state is gated on `html.js` (set by an inline script in the
 * root layout before first paint), so with JavaScript off every section renders
 * plain and visible. `prefers-reduced-motion` keeps everything visible with no
 * movement. Offsets per variant and all timing live in globals.css.
 *
 * `variant` picks the gesture by the block's role:
 *  - `rise`  content sections settling up (default)
 *  - `scale` focal media / full-bleed statements arriving
 *  - `left` / `right` two blocks converging (About origin story)
 */
type Variant = "rise" | "scale" | "left" | "right";

export function Reveal({
  children,
  as,
  variant = "rise",
  delay,
  className,
  amount = 0.12,
}: {
  children: ReactNode;
  as?: ElementType;
  variant?: Variant;
  delay?: number;
  className?: string;
  amount?: number;
}) {
  const Comp = as ?? "div";
  const { ref, shown } = useInView<HTMLElement>(amount);

  return (
    <Comp
      ref={ref}
      data-reveal={variant}
      data-shown={shown ? "" : undefined}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={className}
    >
      {children}
    </Comp>
  );
}

/**
 * A grid or list whose children settle in a short cascade as the group enters
 * view. The stagger is CSS (`:nth-child` transition-delay in globals.css,
 * capped so a long list never crawls); this only renders the grid element
 * itself and flips `data-shown` once. Pass the grid's own layout classes as
 * `className` - it replaces the plain wrapper, it does not add a node.
 */
export function RevealGroup({
  children,
  as,
  className,
  amount = 0.1,
}: {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  amount?: number;
}) {
  const Comp = as ?? "div";
  const { ref, shown } = useInView<HTMLElement>(amount);

  return (
    <Comp ref={ref} data-reveal-group="" data-shown={shown ? "" : undefined} className={className}>
      {children}
    </Comp>
  );
}
