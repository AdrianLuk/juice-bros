"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarCheckIcon,
  CalendarClockIcon,
  CalendarRangeIcon,
  CalendarSearchIcon,
  ChevronDownIcon,
  LayoutDashboardIcon,
  MapPinIcon,
  SettingsIcon,
  UsersIcon,
  UsersRoundIcon,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  BB_SECTIONS,
  BOOKING_BUDDY_ROOT,
  sectionForPath,
  type BbSection,
  type BbSectionId,
} from "@/lib/booking-buddy/routes";

/**
 * Booking Buddy's primary navigation (ADR 0016) in the rec-hall-board world
 * (direction seed 861cf732): a routed park-sign hung across the top of the
 * board on desktop, a kraft tab strip pinned to the bottom edge on mobile. The
 * IA is untouched — five sections, `sectionForPath` off `usePathname`. Only the
 * material changed.
 *
 * The active indicator (`bb-nav-pill` desktop, `bb-tab-pill` mobile) is a
 * shared element that slides between destinations under the moving page
 * (globals.css). The sign itself (`bb-chrome-header` / `bb-chrome-tabs`) is
 * frozen during a route transition.
 */

const SECTION_ICON: Record<BbSectionId, LucideIcon> = {
  dashboard: LayoutDashboardIcon,
  plan: CalendarClockIcon,
  bookings: CalendarCheckIcon,
  friends: UsersIcon,
  settings: SettingsIcon,
};

const CHILD_ICON: Record<string, LucideIcon> = {
  Games: CalendarClockIcon,
  Availability: CalendarRangeIcon,
  "Find a time": CalendarSearchIcon,
  Bookings: CalendarCheckIcon,
  Friends: UsersIcon,
  Groups: UsersRoundIcon,
  Settings: SettingsIcon,
  Facilities: MapPinIcon,
};

const PRIMARY_SECTIONS = BB_SECTIONS.filter((s) => s.id !== "settings");
const SETTINGS_SECTION = BB_SECTIONS.find((s) => s.id === "settings")!;

function isChildActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function DesktopSectionItem({
  section,
  activeSection,
  pathname,
  align = "left",
}: {
  section: BbSection;
  activeSection: BbSectionId | null;
  pathname: string;
  align?: "left" | "right";
}) {
  const active = activeSection === section.id;
  const hasDropdown = section.children.length > 1;

  const trigger = (
    <Link
      href={section.primary}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative isolate flex items-center gap-1 px-2 py-3 font-bb-sign text-[0.82rem] tracking-[0.14em] uppercase transition-colors",
        active
          ? "text-[oklch(0.98_0.02_88)]"
          : "text-[oklch(0.86_0.03_120)] hover:text-white",
      )}
    >
      {/* The routed orange underline. Its own element so it slides between
          sections (`bb-nav-pill`) rather than cross-fading in place. */}
      {active && (
        <span
          aria-hidden
          style={{ viewTransitionName: "bb-nav-pill" }}
          className="absolute inset-x-1 -bottom-px h-[3px] rounded-full bg-brand-orange shadow-[0_0_10px_oklch(0.68_0.19_40/0.6)]"
        />
      )}
      {section.label}
      {hasDropdown && (
        <ChevronDownIcon className="size-3 opacity-60 transition-transform duration-200 group-hover/sec:rotate-180 group-focus-within/sec:rotate-180" />
      )}
    </Link>
  );

  if (!hasDropdown) {
    return trigger;
  }

  return (
    <div className="group/sec relative">
      {trigger}
      <div
        className={cn(
          "invisible absolute top-full z-50 translate-y-1 pt-2 opacity-0 transition-[opacity,transform,visibility] duration-150 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover/sec:visible group-hover/sec:translate-y-0 group-hover/sec:opacity-100 group-focus-within/sec:visible group-focus-within/sec:translate-y-0 group-focus-within/sec:opacity-100 motion-reduce:translate-y-0 motion-reduce:transition-none",
          align === "right" ? "right-0" : "left-0",
        )}
      >
        {/* A kraft card of child links, as if a smaller note pinned below the sign. */}
        <div className="bb-card min-w-48 bb-pinned p-1.5" style={{ "--bb-tilt": "0deg" } as React.CSSProperties}>
          {section.children.map((child) => {
            const ChildIcon = CHILD_ICON[child.label];
            const childActive = isChildActive(pathname, child.href);
            return (
              <Link
                key={child.href}
                href={child.href}
                aria-current={childActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-sm px-2.5 py-2 text-sm transition-colors",
                  childActive
                    ? "bg-brand-orange/12 font-semibold text-[color-mix(in_oklch,var(--brand-orange),black_18%)]"
                    : "text-foreground/80 hover:bg-brand-orange/8 hover:text-foreground",
                )}
              >
                {ChildIcon && (
                  <ChildIcon className="size-4 text-brand-orange" />
                )}
                {child.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function BbAppShell() {
  const pathname = usePathname() ?? "";
  const activeSection = sectionForPath(pathname);

  return (
    <>
      {/* Desktop: the routed sign, hung across the top of the board. */}
      <header
        style={{ viewTransitionName: "bb-chrome-header" }}
        className="sticky top-0 z-40 hidden w-full px-3 pt-2.5 sm:block"
      >
        <div
          className={cn(
            "mx-auto flex h-14 max-w-6xl items-center gap-1 rounded-md px-4 sm:px-5",
            // The sign board: routed forest-green stock with a bevel and a
            // grounded shadow, so it reads as a physical sign, not a browser bar.
            "bg-[oklch(0.33_0.045_152)] text-white",
            "shadow-[inset_0_1px_0_oklch(1_0_0/0.14),inset_0_-2px_3px_oklch(0_0_0/0.32),0_10px_22px_-12px_oklch(0.3_0.06_150/0.65)]",
          )}
        >
          <Link
            href={BOOKING_BUDDY_ROOT}
            className="mr-4 flex items-center gap-2 rounded-sm py-1 pr-1.5 transition-colors hover:bg-white/8"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- local trusted SVG */}
            <img src="/brand/JB_Logo_White.svg" alt="" className="size-6 shrink-0" />
            <span className="font-bb-sign text-[0.9rem] tracking-[0.18em] text-[oklch(0.97_0.02_88)] uppercase">
              Booking Buddy
            </span>
          </Link>

          <nav className="flex items-center gap-1.5">
            {PRIMARY_SECTIONS.map((section) => (
              <DesktopSectionItem
                key={section.id}
                section={section}
                activeSection={activeSection}
                pathname={pathname}
              />
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <span aria-hidden className="h-6 w-px bg-white/20" />
            <DesktopSectionItem
              section={SETTINGS_SECTION}
              activeSection={activeSection}
              pathname={pathname}
              align="right"
            />
          </div>
        </div>
      </header>

      {/* Mobile: a kraft tab strip pinned along the bottom edge of the board. */}
      <nav
        style={{ viewTransitionName: "bb-chrome-tabs" }}
        className="fixed inset-x-0 bottom-0 z-40 flex h-16 border-t-2 border-[var(--bb-cork-edge)] bg-[var(--card)] pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_18px_-10px_oklch(0.3_0.05_45/0.4)] sm:hidden"
        aria-label="Booking Buddy"
      >
        {BB_SECTIONS.map((section) => {
          const Icon = SECTION_ICON[section.id];
          const active = activeSection === section.id;
          return (
            <Link
              key={section.id}
              href={section.primary}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex flex-1 flex-col items-center justify-center gap-1 font-bb-sign text-[0.6rem] tracking-[0.1em] uppercase transition-colors",
                active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {/* An orange pushpin marking the active tab — slides between tabs. */}
              {active && (
                <span
                  aria-hidden
                  style={{ viewTransitionName: "bb-tab-pill" }}
                  className="absolute top-1.5 size-2 rounded-full bg-brand-orange shadow-[0_1px_2px_oklch(0_0_0/0.4)]"
                />
              )}
              <Icon
                className={cn("size-5", active && "text-brand-orange")}
              />
              {section.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
