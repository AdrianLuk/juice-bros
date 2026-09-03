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
 * The dashboard's quick-add actions — "Log a court" (the shared Log-a-booking
 * dialog lifted into `OwnerDashboardCalendar`, issue #303) and "Block off
 * time". Rendered in flow at the head of the sign-up sheet — a bulletin board
 * has no floating FAB, and the old fixed stack covered content on mobile.
 * "Log a court" carries the commit pin; "Block off time" is the quieter
 * secondary.
 */
export function DashboardQuickActions({
  onAddBooking,
}: {
  onAddBooking: () => void;
}) {
  const [availabilityDialogOpen, setAvailabilityDialogOpen] = useState(false);

  return (
    <>
      <Dialog
        open={availabilityDialogOpen}
        onOpenChange={setAvailabilityDialogOpen}
      >
        <DialogTrigger
          render={
            <Button
              size="sm"
              variant="secondary"
              className="h-9 gap-2 rounded-sm px-3.5 font-bb-sign text-[0.68rem] tracking-widest uppercase"
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

      {/* Secondary — the one orange commit pin on the dashboard is "Pin a new
          game" up on the board, and nothing else borrows it. */}
      <Button
        size="sm"
        variant="secondary"
        onClick={onAddBooking}
        className="h-9 gap-2 rounded-sm px-4 font-bb-sign text-[0.68rem] tracking-widest uppercase"
      >
        <PlusIcon />
        Log a court
      </Button>
    </>
  );
}
