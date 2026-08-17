"use client";

import { useState } from "react";
import { CalendarOffIcon, PlusIcon } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [availabilityDialogOpen, setAvailabilityDialogOpen] = useState(false);

  return (
    <div className="fixed right-4 bottom-4 z-40 flex flex-col items-end gap-2.5 sm:right-6 sm:bottom-6">
      <Dialog open={availabilityDialogOpen} onOpenChange={setAvailabilityDialogOpen}>
        <DialogTrigger
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
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set your availability</DialogTitle>
            <DialogDescription>
              Mark a stretch as open or busy. It only shows on your calendar —
              friends can still ask about it, this doesn&apos;t stop a Slot
              invite.
            </DialogDescription>
          </DialogHeader>
          <CreateAvailabilityWindowForm
            onSaved={() => setAvailabilityDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={bookingDialogOpen} onOpenChange={setBookingDialogOpen}>
        <DialogTrigger
          render={
            <Button size="lg" className="gap-2 rounded-full shadow-lg" />
          }
        >
          <PlusIcon />
          Add booking
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log a booking</DialogTitle>
            <DialogDescription>
              Copy it off the facility&apos;s own booking screen — it&apos;ll
              show up on the calendar right after.
            </DialogDescription>
          </DialogHeader>
          {orgs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Bookings need somewhere to be — add a place you play first,
              then come back.
            </p>
          ) : (
            <CreateBookingForm
              orgs={orgs}
              onLogged={() => setBookingDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
