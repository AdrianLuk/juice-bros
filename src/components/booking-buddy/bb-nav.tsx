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
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
    <nav
      className="bb-card bb-scroll-x flex items-center gap-2 overflow-x-auto p-2 sm:flex-wrap sm:gap-1 sm:overflow-visible sm:p-1.5"
      aria-label="Booking Buddy"
    >
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
            "shrink-0 gap-1.5",
          )}
        >
          <Icon className="size-4 text-primary" />
          {label}
        </Link>
      ))}
      <AlertDialog>
        <AlertDialogTrigger
          render={
            <Button
              variant="outline"
              size="default"
              className="ml-1 shrink-0 gap-1.5"
            />
          }
        >
          <LogOutIcon className="size-4" />
          Sign out
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out of Booking Buddy?</AlertDialogTitle>
            <AlertDialogDescription>
              You&apos;ll need to sign in again to see your slots, friends,
              and bookings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay signed in</AlertDialogCancel>
            <form action={signOut}>
              <Button type="submit" variant="destructive">
                Sign out
              </Button>
            </form>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </nav>
  );
}
