"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { MenuIcon } from "lucide-react";

import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Pickle Point Pal is used mid-match on phones and iPads, often in
  // landscape, where a sticky bar eats too much of the limited vertical
  // space. Let it scroll away instead of staying pinned there. Only
  // matters for the desktop-style bar below sm:640 - a landscape phone is
  // often wide enough to already be past that breakpoint.
  const isPicklePointPal = pathname?.startsWith("/tools/pickle-point-pal") ?? false;

  // Home and About both open on a full-bleed colored hero that should run
  // right to the top of the page, so the bar needs to float over it instead
  // of reserving its own row - every other page keeps it sticky so page
  // headings aren't tucked underneath it. Only applies to the desktop bar:
  // on mobile the hero photo is a short banner rather than a full-viewport
  // background, so overlapping it hides the hosts' faces - mobile gets a
  // plain in-flow identity strip instead, plus a corner FAB for the menu.
  const hasOverlayHero = pathname === "/" || pathname === "/about";

  return (
    <>
      {/* Mobile: a plain, non-floating identity strip. It's never sticky or
          fixed, so it can never overlap a hero image below it - it just
          scrolls away like any other content once you pass it. */}
      <div className="flex h-14 w-full shrink-0 items-center bg-brand-orange px-4 text-white sm:hidden">
        <Link href="/" className="flex items-center gap-2">
          {/* Decorative: the "Juice Bros Pickleball" wordmark sits right beside it. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- local trusted SVG, no next/image optimization needed */}
          <img src="/brand/JB_Logo_White.svg" alt="" className="h-7 w-7 shrink-0" />
          <span className="font-heading text-sm font-semibold tracking-tight">
            {siteConfig.name}
          </span>
        </Link>
      </div>

      {/* Desktop: the floating pill nav. */}
      <header
        className={cn(
          "z-40 hidden w-full justify-center px-4 pt-4 sm:flex",
          hasOverlayHero ? "fixed top-0" : "sticky top-0",
          isPicklePointPal &&
            "landscape-short:static tablet-width:static ref-landscape:static"
        )}
      >
        <div className="flex w-full max-w-6xl items-center justify-between gap-4 rounded-full border border-white/15 bg-brand-orange px-4 py-2 text-white shadow-brand-lg">
          <Link href="/" className="flex items-center gap-2 rounded-full py-1 pr-2 pl-1">
            {/* eslint-disable-next-line @next/next/no-img-element -- local trusted SVG, no next/image optimization needed */}
            <img src="/brand/JB_Logo_White.svg" alt="" className="h-7 w-7 shrink-0" />
            <span className="font-heading text-sm font-semibold tracking-tight">
              {siteConfig.name}
            </span>
          </Link>

          <nav className="flex items-center gap-1">
            {siteConfig.nav.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative rounded-full px-4 py-2 text-sm font-medium text-white/70 transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:text-white",
                    active && "text-white"
                  )}
                >
                  {active && (
                    <span className="absolute inset-0 rounded-full bg-white/12" aria-hidden />
                  )}
                  <span className="relative">{item.title}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Mobile: a corner FAB opens a compact panel anchored to the same
          corner, thumb-reachable and never overlapping page content since
          it's a small fixed circle rather than a bar. The panel itself stays
          sized to its content instead of taking the full screen, and both
          its close button and its item animation are anchored to that same
          bottom-right corner so the whole thing reads as growing out of the
          FAB rather than a generic full-screen drawer. */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <button
              type="button"
              aria-label="Open menu"
              className={cn(
                "fixed right-5 bottom-5 z-40 flex size-14 items-center justify-center rounded-full bg-brand-orange text-white shadow-brand-lg transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-95 sm:hidden",
                open && "scale-0"
              )}
            />
          }
        >
          <MenuIcon className="size-6" />
        </SheetTrigger>
        <SheetContent
          side="right"
          showCloseButton={false}
          className="inset-auto data-[side=right]:top-auto data-[side=right]:right-5 data-[side=right]:bottom-5 data-[side=right]:h-auto data-[side=right]:max-h-[70vh] data-[side=right]:w-72 data-[side=right]:max-w-[calc(100vw-2.5rem)] data-[side=right]:origin-bottom-right data-[side=right]:overflow-y-auto data-[side=right]:rounded-3xl data-[side=right]:border data-[side=right]:border-white/10 data-[side=right]:bg-brand-black/95 data-[side=right]:text-white data-[side=right]:shadow-brand-lg data-[side=right]:backdrop-blur-2xl data-[side=right]:data-starting-style:translate-x-4 data-[side=right]:data-starting-style:translate-y-4 data-[side=right]:data-ending-style:translate-x-4 data-[side=right]:data-ending-style:translate-y-4 data-starting-style:scale-90 data-ending-style:scale-90 sm:hidden"
        >
          <SheetHeader className="pb-0">
            <SheetTitle className="text-white/60">{siteConfig.name}</SheetTitle>
          </SheetHeader>
          <nav className="flex flex-col gap-1 px-4 pt-2">
            {siteConfig.nav.map((item, index) => {
              const cornerIndex = siteConfig.nav.length - 1 - index;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  style={{
                    transitionDelay: open ? `${cornerIndex * 40 + 60}ms` : "0ms",
                  }}
                  className={cn(
                    "translate-x-3 translate-y-2 rounded-2xl px-4 py-2.5 font-heading text-lg font-semibold text-white/70 opacity-0 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-white/5 hover:text-white",
                    open && "translate-x-0 translate-y-0 opacity-100",
                    pathname === item.href && "text-brand-orange"
                  )}
                >
                  {item.title}
                </Link>
              );
            })}
          </nav>
          <SheetFooter className="flex-row justify-end pt-0">
            <SheetClose
              aria-label="Close menu"
              className="flex size-11 items-center justify-center rounded-full bg-white/10 transition-colors duration-300 hover:bg-white/20"
            >
              <span className="relative flex h-3.5 w-3.5 items-center justify-center">
                <span className="absolute h-px w-full rotate-45 bg-white" />
                <span className="absolute h-px w-full -rotate-45 bg-white" />
              </span>
            </SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
