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

      {/* Mobile: a corner FAB opens the same full-screen menu, thumb-reachable
          and never overlapping page content since it's a small fixed circle
          rather than a bar. */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <button
              type="button"
              aria-label="Open menu"
              className="fixed right-5 bottom-5 z-40 flex size-14 items-center justify-center rounded-full bg-brand-orange text-white shadow-brand-lg transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-95 sm:hidden"
            />
          }
        >
          <MenuIcon className="size-6" />
        </SheetTrigger>
        <SheetContent
          side="right"
          className="w-screen border-white/10 bg-brand-black/95 text-white backdrop-blur-2xl data-[side=right]:w-screen sm:hidden"
          showCloseButton={false}
        >
          <SheetHeader className="flex-row items-center justify-between">
            <SheetTitle className="text-white/60">{siteConfig.name}</SheetTitle>
            <SheetClose
              aria-label="Close menu"
              className="flex size-9 items-center justify-center rounded-full transition-colors duration-300 hover:bg-white/10"
            >
              <span className="relative flex h-3.5 w-3.5 items-center justify-center">
                <span className="absolute h-px w-full rotate-45 bg-white" />
                <span className="absolute h-px w-full -rotate-45 bg-white" />
              </span>
            </SheetClose>
          </SheetHeader>
          <nav className="flex flex-col gap-1 px-4 pt-4">
            {siteConfig.nav.map((item, index) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                style={{ transitionDelay: open ? `${index * 40 + 60}ms` : "0ms" }}
                className={cn(
                  "translate-y-4 rounded-2xl px-4 py-3 font-heading text-2xl font-semibold text-white/70 opacity-0 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-white/5 hover:text-white",
                  open && "translate-y-0 opacity-100",
                  pathname === item.href && "text-brand-yellow"
                )}
              >
                {item.title}
              </Link>
            ))}
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
}
