"use client";

import Link from "next/link";
import { useState } from "react";

import { siteConfig } from "@/config/site";

/**
 * The home page's own bar.
 *
 * `/` suppresses the global orange pill nav (`SiteChromeSlot`) because the
 * look this page ships is a near-black stage, and a bright pill floating over
 * it would be two identities on one screen. The other marketing routes keep
 * the global chrome until the look rolls out to them.
 *
 * Subscribe points at YouTube: that is the actual subscribe destination and
 * the metric this page exists to move. It is the only place on the page the
 * accent colour is spent.
 */
export function TopBar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--bx-line-soft)] bg-[var(--bx-bg)]/85 backdrop-blur-md">
      <div className="bx-measure flex h-16 items-center justify-between gap-4">
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
                className="text-sm text-[var(--bx-muted)] transition-colors duration-200 hover:text-[var(--bx-ink)]"
              >
                {item.title}
              </Link>
            ))}
        </nav>

        <div className="flex items-center gap-2">
          <a
            href={siteConfig.links.youtube}
            target="_blank"
            rel="noopener noreferrer"
            className="bx-btn bx-btn-sub px-4 py-2.5 text-sm"
          >
            Subscribe
          </a>
          <button
            type="button"
            aria-expanded={open}
            aria-controls="home-nav-panel"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((value) => !value)}
            className="bx-btn bx-btn-ghost size-10 p-0 md:hidden"
          >
            <span aria-hidden className="relative block h-3 w-4">
              <span
                className={`absolute left-0 block h-px w-full bg-current transition-transform duration-200 ${open ? "top-1.5 rotate-45" : "top-0"}`}
              />
              <span
                className={`absolute top-1.5 left-0 block h-px w-full bg-current transition-opacity duration-200 ${open ? "opacity-0" : "opacity-100"}`}
              />
              <span
                className={`absolute left-0 block h-px w-full bg-current transition-transform duration-200 ${open ? "top-1.5 -rotate-45" : "top-3"}`}
              />
            </span>
          </button>
        </div>
      </div>

      {open && (
        <nav
          id="home-nav-panel"
          aria-label="Main"
          className="bx-measure border-t border-[var(--bx-line-soft)] pt-2 pb-4 md:hidden"
        >
          <ul className="grid">
            {siteConfig.nav
              .filter((item) => item.href !== "/")
              .map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="block py-2.5 text-base font-medium text-[var(--bx-muted)] transition-colors duration-200 hover:text-[var(--bx-ink)]"
                  >
                    {item.title}
                  </Link>
                </li>
              ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
