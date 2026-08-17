"use client";

import { CalendarOffIcon, PlusIcon } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { CreateBookingForm } from "@/components/booking-buddy/bookings";
import { CreateAvailabilityWindowForm } from "@/components/booking-buddy/availability";
import type { Org } from "@/lib/booking-buddy/actions/orgs";

/**
 * The dashboard's floating quick-add actions (issue #23's "Add booking",
 * plus "Block off time" so blocking out a busy stretch doesn't need a trip
 * to a separate page). One fixed wrapper around both triggers rather than
 * two independently `fixed` buttons, so their spacing stays correct together
 * instead of two hand-tuned `bottom-*` offsets drifting apart. "Add booking"
 * stays the visually primary, bottom-most action — same position it already
 * held — with "Block off time" stacked above it as the secondary one.
 */
export function DashboardQuickActions({ orgs }: { orgs: Org[] }) {
  return (
    <div className="fixed right-4 bottom-4 z-40 flex flex-col items-end gap-2.5 sm:right-6 sm:bottom-6">
      <Sheet>
        <SheetTrigger
          render={
            <Button
              size="sm"
              variant="secondary"
              className="gap-2 rounded-full shadow-lg"
            />
          }
        >
          <CalendarOffIcon />
          Block off time
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Set your availability</SheetTitle>
            <SheetDescription>
              Mark a stretch as open or busy. It only shows on your calendar —
              friends can still ask about it, this doesn&apos;t stop a Slot
              invite.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-4">
            <CreateAvailabilityWindowForm />
          </div>
        </SheetContent>
      </Sheet>

      <Sheet>
        <SheetTrigger
          render={
            <Button size="lg" className="gap-2 rounded-full shadow-lg" />
          }
        >
          <PlusIcon />
          Add booking
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Log a booking</SheetTitle>
            <SheetDescription>
              Copy it off the facility&apos;s own booking screen — it&apos;ll
              show up on the calendar right after.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-4">
            {orgs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Bookings need somewhere to be — add a place you play first,
                then come back.
              </p>
            ) : (
              <CreateBookingForm orgs={orgs} />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
