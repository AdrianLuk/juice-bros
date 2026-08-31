"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FriendDashboardCalendar } from "@/components/booking-buddy/friend-dashboard-calendar";
import { personLabel } from "@/lib/booking-buddy/connections";
import { getFriendCalendarPageData } from "@/lib/booking-buddy/actions/friend-calendar";

/**
 * The "View calendar" entry point from the friends list (issue #61) — a
 * Dialog instead of a route, so checking a friend's availability doesn't leave
 * the friends list. Data loads on open rather than up front: the trigger
 * only ever renders for a friend `calendarVisibleFriendIds` already cleared
 * server-side (see `friends/page.tsx`), so the `null` this can still return
 * (e.g. the Connection was removed between render and click) is shown as a
 * plain load failure rather than re-deriving the old route's 404 semantics.
 */
export function FriendCalendarDialog({
  username,
  displayName,
}: {
  username: string;
  displayName: string | null;
}) {
  const [open, setOpen] = useState(false);
  const name = personLabel({ displayName, username });

  const calendar = useQuery({
    queryKey: ["booking-buddy", "friend-calendar", username],
    queryFn: () => getFriendCalendarPageData(username),
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        View calendar
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{name}&apos;s calendar</DialogTitle>
          <DialogDescription>
            Availability only. No Slots, and nothing before today.
          </DialogDescription>
        </DialogHeader>
        {calendar.isPending ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : calendar.isError || !calendar.data ? (
          <p className="text-sm text-destructive">
            Couldn&apos;t load {name}&apos;s calendar.
          </p>
        ) : (
          <FriendDashboardCalendar
            bookings={calendar.data.bookings}
            availabilityWindows={calendar.data.availabilityWindows}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
