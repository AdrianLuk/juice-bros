import Link from "next/link";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { AVAILABILITY_PATH } from "@/lib/booking-buddy/routes";
import type { FriendLookingWindow } from "@/lib/booking-buddy/actions/looking";

/**
 * The "Friends looking to play" pool on the Games page (#230) — a flat,
 * soonest-first list of every upcoming "Looking to play" window a friend has
 * shared, each with a one-tap "Propose a game" into the form below.
 *
 * Not an overlap view (that's "Find a time"): no group to pick, no
 * intersection. Just who has put their hand up, and when.
 */
export function FriendsLookingToPlay({
  windows,
}: {
  windows: FriendLookingWindow[];
}) {
  if (windows.length === 0) {
    return (
      <p className="mt-4 bb-outline p-4 text-sm text-muted-foreground">
        Nobody&apos;s marked themselves looking to play right now. Mark yourself
        on{" "}
        <Link href={AVAILABILITY_PATH} className="underline underline-offset-4">
          Availability
        </Link>{" "}
        and your friends will see it here too.
      </p>
    );
  }

  return (
    <ul className="mt-4 divide-y divide-[var(--bb-rule)] overflow-hidden rounded-sm border border-[var(--bb-rule)]">
      {windows.map((window) => (
        <li
          key={window.id}
          className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-4"
        >
          <div className="min-w-0">
            <p className="font-medium">{window.friendName}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {window.rangeLabel}
            </p>
          </div>
          <Link
            href={window.proposeHref}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "shrink-0",
            )}
          >
            Propose a game
          </Link>
        </li>
      ))}
    </ul>
  );
}
