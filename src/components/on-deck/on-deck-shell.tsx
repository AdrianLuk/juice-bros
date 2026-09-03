"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { siteConfig } from "@/config/site";
import { ON_DECK_ROOT } from "@/lib/on-deck/routes";

/**
 * On Deck's standalone chrome. Every surface under `/on-deck/` — the live
 * Session view a Player scans into, the Display tablet, the Organizer floor
 * screen, the Volunteer Link, sign-in — runs inside this instead of the main
 * Juice Bros site nav (which `SiteChromeSlot` suppresses for these paths).
 *
 * Deliberately minimal: a brand bar and a one-line footer, no navigation. The
 * app is a walk-up tool used on a phone at the courts or a tablet on a table —
 * there is nowhere to navigate *to*, and a Player mid-social should not be
 * handed links back into the marketing site. The exact `/on-deck` landing
 * keeps the full site chrome, so this renders nothing there.
 *
 * The live-event surfaces (`/session/*`, `/c/*`) are the dark substitution
 * board (direction seed 92ec9d54); the header/footer switch to the arena
 * palette on those so the chrome doesn't sit as a light strip above a dark
 * board. The Organizer's home/settings pages keep the plain light shell.
 */

function isArenaPath(pathname: string): boolean {
  const sub = pathname.slice(ON_DECK_ROOT.length);
  return sub.startsWith("/session/") || sub.startsWith("/c/");
}

export function OnDeckShellHeader() {
  const pathname = usePathname() ?? "";
  if (!pathname.startsWith(`${ON_DECK_ROOT}/`)) return null;

  const arena = isArenaPath(pathname);

  return (
    <header
      className={
        arena
          ? "od-arena w-full border-b border-arena-line-soft bg-arena-bg"
          : "w-full border-b border-border bg-background"
      }
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center px-4 sm:px-6 lg:px-8">
        <Link
          href={ON_DECK_ROOT}
          className="flex items-center gap-2 rounded-lg py-1 pr-1.5 transition-opacity hover:opacity-80"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- local trusted SVG, no next/image optimization needed */}
          <img src="/brand/JB_Logo.svg" alt="" className="size-6 shrink-0" />
          <span
            className={
              arena
                ? "od-display text-base tracking-[0.06em] text-arena-fg"
                : "font-heading text-sm font-semibold tracking-tight"
            }
          >
            On Deck
          </span>
        </Link>
      </div>
    </header>
  );
}

export function OnDeckShellFooter() {
  const pathname = usePathname() ?? "";
  if (!pathname.startsWith(`${ON_DECK_ROOT}/`)) return null;

  const arena = isArenaPath(pathname);

  return (
    <footer
      className={
        arena
          ? "od-arena w-full border-t border-arena-line-soft bg-arena-bg"
          : "w-full border-t border-border bg-background"
      }
    >
      <div
        className={`mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8 ${
          arena
            ? "od-readout text-arena-dim"
            : "text-xs text-muted-foreground"
        }`}
      >
        On Deck, a {siteConfig.name} app.
      </div>
    </footer>
  );
}
