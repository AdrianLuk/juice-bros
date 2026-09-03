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
import { CreateAvailabilityWindowForm } from "@/components/booking-buddy/availability";

/**
 * The dashboard's floating quick-add actions (issue #23's "Add booking",
 * plus "Block off time" so blocking out a busy stretch doesn't need a trip
 * to a separate page). One fixed wrapper around both triggers rather than
 * two independently `fixed` buttons, so their spacing stays correct together
 * instead of two hand-tuned `bottom-*` offsets drifting apart. "Add booking"
 * stays the visually primary, bottom-most action — same position it already
 * held — with "Block off time" stacked above it as the secondary one.
 *
 * "Add booking" no longer owns its own dialog: the Log-a-booking dialog is a
 * single shared instance lifted up into `OwnerDashboardCalendar` (issue #303),
 * so a calendar-cell "+" and this FAB open the same form. This button just
 * asks the owner to open it, with no prefill. "Block off time" keeps its own
 * dialog here — it's unrelated to the booking form.
 */
export function DashboardQuickActions({
  onAddBooking,
}: {
  onAddBooking: () => void;
}) {
  const [availabilityDialogOpen, setAvailabilityDialogOpen] = useState(false);

  return (
    <div className="fixed right-4 bottom-24 z-40 flex flex-col items-end gap-2.5 sm:right-6 sm:bottom-6">
      <Dialog
        open={availabilityDialogOpen}
        onOpenChange={setAvailabilityDialogOpen}
      >
        <DialogTrigger
          render={
            <Button
              size="sm"
              variant="secondary"
              className="h-11 gap-2 rounded-sm border border-[var(--bb-cork-edge)]/25 px-4 font-bb-sign text-[0.72rem] tracking-widest uppercase shadow-[var(--bb-contact-shadow)] hover:-translate-y-0.5 active:translate-y-0 motion-reduce:hover:translate-y-0"
            />
          }
        >
          <CalendarOffIcon />
          Block off time
        </DialogTrigger>
        <DialogContent className="bb-theme sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Set your availability</DialogTitle>
            <DialogDescription>
              Mark a stretch as looking to play or busy. It only shows on your
              calendar. Friends can still ask about it, this doesn&apos;t stop a
              game invite.
            </DialogDescription>
          </DialogHeader>
          <CreateAvailabilityWindowForm
            onSaved={() => setAvailabilityDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Button
        size="lg"
        onClick={onAddBooking}
        className="relative h-11 gap-2 rounded-sm px-5 font-bb-sign text-[0.74rem] tracking-widest uppercase shadow-[var(--bb-contact-shadow)] hover:-translate-y-0.5 active:translate-y-0 motion-reduce:hover:translate-y-0"
      >
        <span
          aria-hidden
          className="bb-pin bb-pin--commit"
          style={{ top: "-0.55rem" }}
        />
        <PlusIcon />
        Log a court
      </Button>
    </div>
  );
}
