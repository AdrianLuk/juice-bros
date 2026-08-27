"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarCheckIcon,
  CalendarClockIcon,
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
  SETTINGS_PATH,
  sectionForPath,
  type BbSection,
  type BbSectionId,
} from "@/lib/booking-buddy/routes";

/**
 * Booking Buddy's primary navigation (ADR 0016), rendered once from the section
 * layout instead of once per page. Desktop gets a sticky top bar with the
 * section dropdowns; mobile gets a fixed bottom tab bar. Both key off
 * `usePathname` via `sectionForPath` — reversing the old per-page nav's "pages
 * know their own route, don't read the pathname client-side" note, which the
 * ADR documents.
 *
 * The sibling pill row under each page heading is a separate shared component
 * (`BbSectionNav`); only this primary bar differs by breakpoint.
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
  Bookings: CalendarCheckIcon,
  Facilities: MapPinIcon,
  Friends: UsersIcon,
  Groups: UsersRoundIcon,
};

const PRIMARY_SECTIONS = BB_SECTIONS.filter((s) => s.id !== "settings");

function isChildActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function DesktopSectionItem({
  section,
  activeSection,
  pathname,
}: {
  section: BbSection;
  activeSection: BbSectionId | null;
  pathname: string;
}) {
  const Icon = SECTION_ICON[section.id];
  const active = activeSection === section.id;
  const hasDropdown = section.children.length > 1;

  const trigger = (
    <Link
      href={section.primary}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-secondary text-secondary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="size-4" />
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
      <div className="invisible absolute left-0 top-full z-50 pt-2 opacity-0 transition-opacity duration-150 group-hover/sec:visible group-hover/sec:opacity-100 group-focus-within/sec:visible group-focus-within/sec:opacity-100">
        <div className="min-w-44 rounded-lg border border-border/60 bg-popover p-1 text-popover-foreground shadow-md">
          {section.children.map((child) => {
            const ChildIcon = CHILD_ICON[child.label];
            const childActive = isChildActive(pathname, child.href);
            return (
              <Link
                key={child.href}
                href={child.href}
                aria-current={childActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors",
                  childActive
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {ChildIcon && <ChildIcon className="size-4" />}
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
      {/* Desktop: sticky full-width top bar. */}
      <header className="sticky top-0 z-40 hidden w-full border-b border-border/60 bg-background/85 backdrop-blur-sm sm:block">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-1 px-4 sm:px-6 lg:px-8">
          <Link
            href={BOOKING_BUDDY_ROOT}
            className="mr-3 flex items-center gap-2 rounded-md py-1 pr-1"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- local trusted SVG, no next/image optimization needed */}
            <img src="/brand/JB_Logo.svg" alt="" className="size-6 shrink-0" />
            <span className="font-heading text-sm font-semibold tracking-tight">
              Booking Buddy
            </span>
          </Link>

          {PRIMARY_SECTIONS.map((section) => (
            <DesktopSectionItem
              key={section.id}
              section={section}
              activeSection={activeSection}
              pathname={pathname}
            />
          ))}

          <div className="ml-auto flex items-center gap-2">
            <span aria-hidden className="h-5 w-px bg-border" />
            <Link
              href={SETTINGS_PATH}
              aria-current={activeSection === "settings" ? "page" : undefined}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                activeSection === "settings"
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <SettingsIcon className="size-4" />
              Settings
            </Link>
          </div>
        </div>
      </header>

      {/* Mobile: fixed bottom tab bar. Not a bottom-right FAB — that corner is
          the dashboard's quick-add. */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex h-16 border-t border-border/60 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm sm:hidden"
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
                "flex flex-1 flex-col items-center justify-center gap-1 text-[0.65rem] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="size-5" />
              {section.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
