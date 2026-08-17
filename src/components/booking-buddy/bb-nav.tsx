import Link from "next/link";
import {
  CalendarClockIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  MapPinIcon,
  SettingsIcon,
  UsersIcon,
  UsersRoundIcon,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { signOut } from "@/lib/booking-buddy/actions/auth";
import {
  BOOKING_BUDDY_ROOT,
  FRIENDS_PATH,
  GROUPS_PATH,
  ORGS_PATH,
  SETTINGS_PATH,
  SLOTS_PATH,
} from "@/lib/booking-buddy/routes";

export type BbNavKey =
  | "dashboard"
  | "slots"
  | "friends"
  | "groups"
  | "orgs"
  | "settings";

const NAV_ITEMS: { key: BbNavKey; href: string; label: string; icon: LucideIcon }[] = [
  { key: "dashboard", href: BOOKING_BUDDY_ROOT, label: "Dashboard", icon: LayoutDashboardIcon },
  { key: "slots", href: SLOTS_PATH, label: "Slots", icon: CalendarClockIcon },
  { key: "friends", href: FRIENDS_PATH, label: "Friends", icon: UsersIcon },
  { key: "groups", href: GROUPS_PATH, label: "Friend groups", icon: UsersRoundIcon },
  { key: "orgs", href: ORGS_PATH, label: "Facilities", icon: MapPinIcon },
  { key: "settings", href: SETTINGS_PATH, label: "Settings", icon: SettingsIcon },
];

/**
 * The nav every signed-in Booking Buddy screen shares (issue: "use it from
 * any screen") — previously the dashboard alone. `current` marks which item
 * is this page, rather than reading the pathname client-side, since every
 * page rendering this already knows its own route as a server component.
 */
export function BookingBuddyNav({ current }: { current?: BbNavKey }) {
  return (
    <nav className="bb-card flex flex-wrap items-center gap-0.5 p-1.5" aria-label="Booking Buddy">
      {NAV_ITEMS.map(({ key, href, label, icon: Icon }) => (
        <Link
          key={key}
          href={href}
          aria-current={current === key ? "page" : undefined}
          className={cn(
            buttonVariants({
              variant: current === key ? "secondary" : "ghost",
              size: "default",
            }),
            "gap-1.5",
          )}
        >
          <Icon className="size-4 text-primary" />
          {label}
        </Link>
      ))}
      <form action={signOut} className="ml-1">
        <Button type="submit" variant="outline" size="default" className="gap-1.5">
          <LogOutIcon className="size-4" />
          Sign out
        </Button>
      </form>
    </nav>
  );
}
