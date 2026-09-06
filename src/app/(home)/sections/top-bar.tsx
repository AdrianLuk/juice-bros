"use client";

import Link from "next/link";
import { useState } from "react";
import { MenuIcon } from "lucide-react";

import { siteConfig } from "@/config/site";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

/**
 * The home page's own chrome.
 *
 * `/` suppresses the global pill nav (`SiteChromeSlot`) so this page can carry
 * the near-black look end to end; the bar itself keeps the brand orange the
 * site has always had, so the top of the page still reads as Juice Bros before
 * anything else loads.
 *
 * Because the bar is orange, Subscribe cannot be: a brand-orange button on a
 * brand-orange ground reads as an outline. It is near-black, which is also the
 * page's own ground, so the bar and the page below it are visibly one thing.
 * The platform colours stay reserved for the platform buttons in the content.
 *
 * On phones the bar carries identity only and navigation moves to a corner
 * button, thumb-reachable and never overlapping the page: a small fixed circle
 * rather than a bar, opening a panel anchored to the same corner so the whole
 * thing reads as growing out of it.
 */
export function TopBar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="relative z-40 bg-[var(--bx-accent)] text-white">
        <div className="bx-measure flex h-14 items-center justify-between gap-4 sm:h-16">
          <Link href="/" className="flex items-center gap-2.5">
            {/* Decorative: the wordmark sits right beside it. */}
            {/* eslint-disable-next-line @next/next/no-img-element -- local trusted SVG, no next/image optimization needed */}
            <img src="/brand/JB_Logo_White.svg" alt="" className="size-7 shrink-0" />
            <span className="text-[0.9375rem] font-semibold tracking-tight">
              {siteConfig.name}
            </span>
          </Link>

          <nav aria-label="Main" className="hidden items-center gap-7 md:flex">
            {siteConfig.nav
              .filter((item) => item.href !== "/")
              .map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-sm text-white/80 transition-colors duration-200 hover:text-white"
                >
                  {item.title}
                </Link>
              ))}
          </nav>

          <a
            href={siteConfig.links.youtube}
            target="_blank"
            rel="noopener noreferrer"
            className="bx-btn bx-btn-sub hidden px-4 py-2.5 text-sm sm:inline-flex"
          >
            Subscribe
          </a>
        </div>
      </header>

      {/* The corner menu, phones only. */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <button
              type="button"
              aria-label="Open menu"
              className={`fixed right-5 bottom-5 z-50 flex size-14 items-center justify-center rounded-full bg-[var(--bx-accent)] text-white shadow-[0_10px_30px_-8px_rgb(0_0_0/0.8)] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-95 sm:hidden ${
                open ? "scale-0" : ""
              }`}
            />
          }
        >
          <MenuIcon className="size-6" />
        </SheetTrigger>
        {/* `bx-dark` is repeated here on purpose: SheetContent renders through a
            portal at the document root, outside the page's own `.bx-dark`
            subtree, so without it every `--bx-*` token in this panel resolves to
            nothing and the buttons come out unpainted. */}
        <SheetContent
          side="right"
          showCloseButton={false}
          className="bx-dark inset-auto data-[side=right]:top-auto data-[side=right]:right-5 data-[side=right]:bottom-5 data-[side=right]:h-auto data-[side=right]:max-h-[70vh] data-[side=right]:w-72 data-[side=right]:max-w-[calc(100vw-2.5rem)] data-[side=right]:origin-bottom-right data-[side=right]:overflow-y-auto data-[side=right]:rounded-3xl data-[side=right]:border data-[side=right]:border-white/10 data-[side=right]:bg-[var(--bx-raised)]/95 data-[side=right]:text-white data-[side=right]:backdrop-blur-2xl data-[side=right]:data-starting-style:translate-x-4 data-[side=right]:data-starting-style:translate-y-4 data-[side=right]:data-ending-style:translate-x-4 data-[side=right]:data-ending-style:translate-y-4 data-starting-style:scale-90 data-ending-style:scale-90 sm:hidden"
        >
          <SheetHeader className="pb-0">
            <SheetTitle className="text-[var(--bx-muted)]">{siteConfig.name}</SheetTitle>
          </SheetHeader>
          <nav aria-label="Main" className="flex flex-col gap-1 px-4 pt-2">
            {siteConfig.nav.map((item, index) => {
              const cornerIndex = siteConfig.nav.length - 1 - index;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  style={{ transitionDelay: open ? `${cornerIndex * 40 + 60}ms` : "0ms" }}
                  className={`translate-x-3 translate-y-2 rounded-2xl px-4 py-2.5 text-lg font-semibold text-[var(--bx-muted)] opacity-0 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-white/5 hover:text-white ${
                    open ? "translate-x-0 translate-y-0 opacity-100" : ""
                  }`}
                >
                  {item.title}
                </Link>
              );
            })}
            <a
              href={siteConfig.links.youtube}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              style={{ transitionDelay: open ? "20ms" : "0ms" }}
              className={`bx-btn bx-btn-yt mt-3 translate-y-2 opacity-0 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                open ? "translate-y-0 opacity-100" : ""
              }`}
            >
              Subscribe on YouTube
            </a>
          </nav>
          <SheetFooter className="flex-row justify-end pt-0">
            <SheetClose
              aria-label="Close menu"
              className="flex size-11 items-center justify-center rounded-full bg-white/10 transition-colors duration-300 hover:bg-white/20"
            >
              <span aria-hidden className="relative flex h-3.5 w-3.5 items-center justify-center">
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
