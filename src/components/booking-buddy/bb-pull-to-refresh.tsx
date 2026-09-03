"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { RotateCwIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Pull-to-refresh for the signed-in Booking Buddy app.
 *
 * The app opts out of the browser's own overscroll (globals.css:
 * `overscroll-behavior-y: none` on `html:has(.bb-app-chrome)`), which also
 * takes the native pull-to-refresh with it — and there's no native one at all
 * once it's installed to the home screen. This puts a real one back: drag down
 * from the very top, past the threshold, and the page refetches — both the RSC
 * tree (`router.refresh()`) and the TanStack Query cache — then the strip
 * snaps away.
 *
 * Touch only. It arms on a one-finger touch that starts at `scrollY === 0`,
 * engages only once the drag reads as vertical-and-downward (a mostly-sideways
 * drag is left alone, so the calendar and any horizontal scrollers keep
 * theirs), and bails the moment the page isn't at the top. Listeners sit on
 * this wrapper, not `window`, so a touch inside a portalled dialog never
 * reaches it.
 */

const TRIGGER = 72; // px of travel past which a release refreshes
const REST = 56; // px the strip holds at while the refetch is in flight
const MAX = 104; // px hard cap on the rubber-band
const MIN_VISIBLE = 550; // ms the spinner stays up even on an instant refetch
const RESIST = 0.5; // finger travel → strip travel, the rubber-band feel

type Phase = "idle" | "pull" | "refresh" | "settle";

export function BbPullToRefresh({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();

  const [phase, setPhase] = useState<Phase>("idle");
  const [offset, setOffset] = useState(0);
  const [queriesSettled, setQueriesSettled] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  const wrapRef = useRef<HTMLDivElement>(null);
  const startedAt = useRef(0);

  // The touch handlers are bound once (stable deps); these mirror the render
  // state so a handler reads the live value, and are only ever written from
  // handlers and effects — never during render.
  const phaseRef = useRef<Phase>("idle");
  const offsetRef = useRef(0);

  const setPhaseBoth = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);
  const setOffsetBoth = useCallback((next: number) => {
    offsetRef.current = next;
    setOffset(next);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot read of a client-only media query on mount
    setReducedMotion(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
  }, []);

  const runRefresh = useCallback(() => {
    startedAt.current = Date.now();
    setQueriesSettled(false);
    setPhaseBoth("refresh");
    setOffsetBoth(REST);
    queryClient
      .invalidateQueries()
      .catch(() => {})
      .finally(() => setQueriesSettled(true));
    startTransition(() => router.refresh());
  }, [queryClient, router, setPhaseBoth, setOffsetBoth]);

  // Leave the "refresh" phase once both the RSC refresh and the query
  // invalidation have settled — but never before MIN_VISIBLE, so a fast
  // refetch still reads as a deliberate action rather than a flicker.
  useEffect(() => {
    if (phase !== "refresh" || isPending || !queriesSettled) return;
    const wait = Math.max(0, MIN_VISIBLE - (Date.now() - startedAt.current));
    const t = setTimeout(() => {
      setPhaseBoth("settle");
      setOffsetBoth(0);
    }, wait);
    return () => clearTimeout(t);
  }, [phase, isPending, queriesSettled, setPhaseBoth, setOffsetBoth]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    let startY = 0;
    let startX = 0;
    let armed = false;
    let active = false;

    const reset = () => {
      armed = false;
      active = false;
    };

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return reset();
      const p = phaseRef.current;
      if (p === "refresh" || p === "settle") return;
      if (window.scrollY > 0) return;
      startY = e.touches[0].clientY;
      startX = e.touches[0].clientX;
      armed = true;
      active = false;
    };

    const onMove = (e: TouchEvent) => {
      if (!armed) return;
      const dy = e.touches[0].clientY - startY;
      const dx = e.touches[0].clientX - startX;

      if (!active) {
        if (dy <= 0 || window.scrollY > 0) return reset();
        // Let a mostly-sideways drag through untouched.
        if (Math.abs(dx) > Math.abs(dy)) return reset();
        // Wait for a few px of intent before hijacking the gesture.
        if (dy < 6) return;
        active = true;
        setPhaseBoth("pull");
      }

      // The strip can't be scrolled and pulled at once.
      e.preventDefault();
      setOffsetBoth(Math.min(MAX, dy * RESIST));
    };

    const onEnd = () => {
      if (active) {
        if (offsetRef.current >= TRIGGER) {
          runRefresh();
        } else {
          setPhaseBoth("settle");
          setOffsetBoth(0);
        }
      }
      reset();
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [runRefresh, setPhaseBoth, setOffsetBoth]);

  const animating = phase === "refresh" || phase === "settle";
  const spinning = phase === "refresh";
  const progress = Math.min(1, offset / TRIGGER);
  const transitionMs = reducedMotion ? 1 : 340;

  return (
    <div
      ref={wrapRef}
      className={cn("relative", className)}
      style={
        phase === "idle"
          ? undefined
          : {
              transform: `translateY(${offset}px)`,
              transition: animating
                ? `transform ${transitionMs}ms cubic-bezier(0.32, 0.72, 0, 1)`
                : "none",
              willChange: "transform",
            }
      }
      onTransitionEnd={() => {
        if (phase === "settle") {
          setPhaseBoth("idle");
          setOffsetBoth(0);
        }
      }}
    >
      {phase !== "idle" && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-30 flex h-0 justify-center"
        >
          <span
            className="flex size-9 items-center justify-center rounded-full bg-card text-foreground shadow-(--bb-contact-shadow) ring-1 ring-(--bb-cork-edge)/25"
            style={{
              opacity: spinning ? 1 : progress,
              transform: `translateY(-150%) scale(${0.7 + 0.3 * progress})`,
            }}
          >
            <RotateCwIcon
              className={cn("size-4", spinning && "animate-spin")}
              style={
                spinning
                  ? undefined
                  : { transform: `rotate(${Math.round(progress * 270)}deg)` }
              }
            />
          </span>
        </div>
      )}
      {children}
    </div>
  );
}
