"use client";

import { PlusIcon } from "lucide-react";

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
import type { Org } from "@/lib/booking-buddy/actions/orgs";

/**
 * The floating "+ Add booking" button (issue #23) — opens the same
 * `CreateBookingForm` the full Bookings page uses, in a sheet, so a Booking
 * can be logged without leaving the dashboard. Deliberately the *existing*
 * form rather than a second copy: same validation, same server action, same
 * error messages.
 */
export function QuickAddBooking({ orgs }: { orgs: Org[] }) {
  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button
            size="lg"
            className="fixed right-4 bottom-4 z-40 gap-2 rounded-full shadow-lg sm:right-6 sm:bottom-6"
          />
        }
      >
        <PlusIcon />
        Add booking
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Log a booking</SheetTitle>
          <SheetDescription>
            Copy it off the facility&apos;s own booking screen — it&apos;ll show up
            on the calendar right after.
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-4">
          {orgs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Bookings need somewhere to be — add a place you play first, then
              come back.
            </p>
          ) : (
            <CreateBookingForm orgs={orgs} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
