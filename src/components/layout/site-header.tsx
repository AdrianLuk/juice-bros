"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

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
  // space. Let it scroll away instead of staying pinned there.
  const isPicklePointPal = pathname?.startsWith("/tools/pickle-point-pal") ?? false;

  // Home and About both open on a full-bleed colored hero that should run
  // right to the top of the page, so the bar needs to float over it instead
  // of reserving its own row - every other page keeps it sticky so page
  // headings aren't tucked underneath it.
  const hasOverlayHero = pathname === "/" || pathname === "/about";

  return (
    <header
      className={cn(
        "z-40 flex w-full justify-center px-3 pt-3 sm:px-4 sm:pt-4",
        hasOverlayHero ? "fixed top-0" : "sticky top-0",
        isPicklePointPal &&
          "landscape-short:static tablet-width:static ref-landscape:static"
      )}
    >
      <div className="flex w-full max-w-6xl items-center justify-between gap-4 rounded-full border border-white/15 bg-brand-orange px-3 py-2 text-white shadow-brand-lg sm:px-4">
        <Link href="/" className="flex items-center gap-2 rounded-full py-1 pr-2 pl-1">
          {/* eslint-disable-next-line @next/next/no-img-element -- local trusted SVG, no next/image optimization needed */}
          <img src="/brand/JB_Logo_White.svg" alt="" className="h-7 w-7 shrink-0" />
          <span className="hidden font-heading text-sm font-semibold tracking-tight sm:inline">
            {siteConfig.name}
          </span>
        </Link>

        <nav className="hidden items-center gap-1 sm:flex">
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

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={
              <button
                type="button"
                aria-label={open ? "Close menu" : "Open menu"}
                className="group/burger relative flex size-9 shrink-0 items-center justify-center rounded-full transition-colors duration-300 hover:bg-white/10 sm:hidden"
              />
            }
          >
            <span className="relative flex h-3.5 w-4 flex-col justify-between">
              <span
                className={cn(
                  "h-px w-full origin-center bg-white transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
                  open && "translate-y-[6.5px] rotate-45"
                )}
              />
              <span
                className={cn(
                  "h-px w-full origin-center bg-white transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
                  open && "translate-y-[-6.5px] -rotate-45"
                )}
              />
            </span>
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
      </div>
    </header>
  );
}
