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
 */
export function OnDeckShellHeader() {
  const pathname = usePathname() ?? "";
  if (!pathname.startsWith(`${ON_DECK_ROOT}/`)) return null;

  return (
    <header className="w-full border-b border-border bg-background">
      <div className="mx-auto flex h-14 max-w-5xl items-center px-4 sm:px-6 lg:px-8">
        <Link
          href={ON_DECK_ROOT}
          className="flex items-center gap-2 rounded-lg py-1 pr-1.5 transition-colors hover:opacity-80"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- local trusted SVG, no next/image optimization needed */}
          <img src="/brand/JB_Logo.svg" alt="" className="size-7 shrink-0" />
          <span className="font-heading text-sm font-semibold tracking-tight">
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

  return (
    <footer className="w-full border-t border-border bg-background">
      <div className="mx-auto max-w-5xl px-4 py-4 text-xs text-muted-foreground sm:px-6 lg:px-8">
        On Deck — a {siteConfig.name} app.
      </div>
    </footer>
  );
}
